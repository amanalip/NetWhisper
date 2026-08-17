/**
 * Main Process for NetWhisper Electron Desktop App.
 * Handles: frameless window, Python daemon lifecycle, system tray, IPC, and security boundaries.
 */

// ---- Core Electron and Node.js imports ----
const { app, BrowserWindow, ipcMain, Tray, Menu, Notification, dialog, shell, session } = require('electron');
const path = require('path');
const fs   = require('fs');
const { spawn, execFile } = require('child_process');

// ---- Global state ----
let mainWindow          = null;   // Reference to the primary BrowserWindow
let tray                = null;   // Reference to the system tray icon
let pythonDaemonProcess = null;   // Reference to the spawned Python telemetry process
let daemonReady         = false;  // Tracks whether the Python HTTP server is accepting connections

// Root directory of the project (parent of the electron/ folder)
const ROOT_DIR  = path.resolve(__dirname, '..');

// In production (packaged) electron runs the built dist/; in development it hits the Vite dev server.
// When the user runs "electron ." directly from the repo (no NODE_ENV), treat it as production.
const isDev = process.env.NODE_ENV === 'development';

// ---- Helper: wait until the Python daemon is accepting TCP connections on 127.0.0.1:8765 ----
function waitForDaemon(host, port, timeoutMs, callback) {
  const net       = require('net');
  const startTime = Date.now();

  function attempt() {
    const sock = new net.Socket();
    sock.setTimeout(200);
    sock.on('connect', () => {
      sock.destroy();
      callback(null); // success
    });
    sock.on('error', () => {
      sock.destroy();
      if (Date.now() - startTime > timeoutMs) {
        callback(new Error('Daemon did not start in time'));
      } else {
        setTimeout(attempt, 250); // retry every 250ms
      }
    });
    sock.on('timeout', () => {
      sock.destroy();
      if (Date.now() - startTime > timeoutMs) {
        callback(new Error('Daemon did not start in time'));
      } else {
        setTimeout(attempt, 250);
      }
    });
    sock.connect(port, host);
  }
  attempt();
}

// ---- Start the background Python telemetry engine ----
function startPythonDaemon() {
  console.log('[MAIN] Starting Python telemetry engine...');

  // Prefer the project virtualenv Python; fall back to the system python3.
  const venvPython = path.join(ROOT_DIR, '.venv', 'bin', 'python3');
  const pythonBin  = fs.existsSync(venvPython) ? venvPython : 'python3';
  const serverScript = path.join(ROOT_DIR, 'server', 'main.py');

  console.log('[MAIN] Python binary:', pythonBin);
  console.log('[MAIN] Server script:', serverScript);

  // Spawn Python as a child of this process.
  // cwd = ROOT_DIR so that relative imports inside server/ resolve correctly.
  pythonDaemonProcess = spawn(pythonBin, [serverScript], {
    cwd: ROOT_DIR,
    env: { ...process.env, PYTHONUNBUFFERED: '1', PORT: '8765' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  pythonDaemonProcess.stdout.on('data', (data) => {
    console.log('[PYTHON]', data.toString().trim());
  });
  pythonDaemonProcess.stderr.on('data', (data) => {
    console.log('[PYTHON ERR]', data.toString().trim());
  });
  pythonDaemonProcess.on('close', (code) => {
    console.log(`[MAIN] Python engine exited (code ${code})`);
    daemonReady = false;
  });
  pythonDaemonProcess.on('error', (err) => {
    console.error('[MAIN] Failed to start Python engine:', err.message);
  });
}

// ---- Stop the Python daemon cleanly ----
function stopPythonDaemon() {
  if (pythonDaemonProcess) {
    console.log('[MAIN] Stopping Python engine...');
    pythonDaemonProcess.kill('SIGTERM');
    pythonDaemonProcess = null;
  }
}

// ---- Create the main frameless BrowserWindow ----
function createWindow() {
  // Configure strict Content-Security-Policy for all responses loaded in this session.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self';" +
          " script-src 'self' 'unsafe-inline';" +
          " connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:* ws://localhost:* http://localhost:*;" +
          " style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;" +
          " font-src 'self' https://fonts.gstatic.com data:;" +
          " img-src 'self' data: https:;"
        ]
      }
    });
  });

  mainWindow = new BrowserWindow({
    width:           1280,
    height:          840,
    minWidth:        1000,
    minHeight:       650,
    frame:           false,       // Custom frameless title bar
    backgroundColor: '#06090e',   // Prevents white flash before paint
    show:            false,       // Show only once content is ready
    webPreferences: {
      preload:          path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,     // Renderer cannot access Node globals
      nodeIntegration: false,     // Renderer cannot require() Node modules
      sandbox: true               // Renderer runs in a Chromium sandbox
    }
  });

  // Load the built React bundle or dev server depending on mode.
  if (isDev) {
    console.log('[MAIN] Dev mode: loading http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools(); // open devtools in dev mode
  } else {
    const indexPath = path.join(ROOT_DIR, 'dist', 'index.html');
    console.log('[MAIN] Production mode: loading', indexPath);
    mainWindow.loadFile(indexPath);
  }

  // Show the window after the first paint to avoid a blank flash.
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('[MAIN] Window is visible.');
  });

  // Block all external popup navigations.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Block navigation away from our local origin.
  mainWindow.webContents.on('will-navigate', (event, navUrl) => {
    try {
      const parsed = new URL(navUrl);
      // Allow file:// (production dist) and http://localhost or http://127.0.0.1 (dev server).
      // Block everything else to prevent open-redirect attacks.
      const isFile  = parsed.protocol === 'file:';
      const isLocal = parsed.protocol === 'http:' &&
                      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
      if (!isFile && !isLocal) event.preventDefault();
    } catch (_) {
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ---- Create system tray ----
function createTray() {
  try {
    // Build a minimal context menu without requiring a PNG asset.
    const contextMenu = Menu.buildFromTemplate([
      { label: 'NetWhisper', enabled: false },
      { type: 'separator' },
      {
        label: 'Show Dashboard',
        click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } }
      },
      {
        label: 'Minimize to Tray',
        click: () => { if (mainWindow) mainWindow.hide(); }
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ]);

    // Tray icons require a PNG file; use a 1×1 transparent PNG as a fallback
    // if no icon asset is bundled yet so the app still works.
    const iconPath = path.join(ROOT_DIR, 'src', 'icon.png');
    if (fs.existsSync(iconPath)) {
      tray = new Tray(iconPath);
      tray.setToolTip('NetWhisper Network Monitor');
      tray.setContextMenu(contextMenu);
      tray.on('double-click', () => { if (mainWindow) mainWindow.show(); });
    }
  } catch (err) {
    console.log('[TRAY] Tray init skipped:', err.message);
  }
}

// ---- IPC: window controls ----
ipcMain.on('window:minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('window:close', () => { if (mainWindow) mainWindow.close(); });

// ---- IPC: export telemetry log to disk ----
ipcMain.handle('export:logs', async (_event, jsonData) => {
  if (!mainWindow) return { success: false, error: 'No active window' };
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title:       'Export NetWhisper Log',
    defaultPath: `netwhisper-${Date.now()}.json`,
    filters:     [{ name: 'JSON', extensions: ['json'] }]
  });
  if (filePath) {
    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf8');
    return { success: true, filePath };
  }
  return { success: false, cancelled: true };
});

// ---- IPC: desktop notification ----
ipcMain.on('notify:alert', (_event, { title, message }) => {
  if (Notification.isSupported()) {
    new Notification({
      title: title || 'NetWhisper Alert',
      body:  message || 'High-risk background network activity detected.'
    }).show();
  }
});

// ---- IPC: safe external URL opener ----
ipcMain.handle('open:external', async (_event, url) => {
  if (typeof url === 'string' && url.startsWith('https://')) {
    await shell.openExternal(url);
    return { success: true };
  }
  return { success: false, error: 'Blocked non-https URL' };
});

// ---- App lifecycle ----
app.whenReady().then(() => {
  // 1. Start the Python backend daemon.
  startPythonDaemon();

  // 2. Wait up to 8 seconds for the daemon to accept connections, then open the window.
  waitForDaemon('127.0.0.1', 8765, 8000, (err) => {
    if (err) {
      console.warn('[MAIN] Daemon did not respond in time; opening window anyway.');
    } else {
      console.log('[MAIN] Daemon is ready on port 8765.');
      daemonReady = true;
    }
    createWindow();
    createTray();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', stopPythonDaemon);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
