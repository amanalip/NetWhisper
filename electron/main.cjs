/**
 * Main Process for NetWhisper Electron Desktop App.
 * Handles lifecycle management, frameless window framing, system tray integration,
 * background Python daemon supervision, and security boundary enforcement.
 */

// Import core modules from Electron.
const { app, BrowserWindow, ipcMain, Tray, Menu, Notification, dialog, shell, session } = require('electron');
// Import Node.js path module for resolving directory locations.
const path = require('path');
// Import child_process spawn to supervise the local Python telemetry backend daemon.
const { spawn } = require('child_process');

// Keep global references to prevent garbage collection.
let mainWindow = null;
let tray = null;
let pythonDaemonProcess = null;

// Determine if application is running in development mode.
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

/**
 * Spawns and supervises the local Python telemetry daemon on 127.0.0.1.
 */
function startPythonDaemon() {
  console.log('[MAIN] Starting NetWhisper local Python telemetry engine...');
  // Resolve path to the virtualenv Python binary.
  const rootDir = path.resolve(__dirname, '..');
  const venvPython = path.join(rootDir, '.venv', 'bin', 'python3');
  const serverScript = path.join(rootDir, 'server', 'main.py');

  // Check if virtual environment python exists, otherwise fallback to system python.
  const pythonBin = require('fs').existsSync(venvPython) ? venvPython : 'python3';

  // Spawn Python daemon as a detached child process with unbuffered output.
  pythonDaemonProcess = spawn(pythonBin, [serverScript], {
    cwd: path.join(rootDir, 'server'),
    env: { ...process.env, PYTHONUNBUFFERED: '1', PORT: '8765' }
  });

  // Log standard output from daemon.
  pythonDaemonProcess.stdout.on('data', (data) => {
    console.log(`[PYTHON ENGINE] ${data.toString().trim()}`);
  });

  // Log error output from daemon.
  pythonDaemonProcess.stderr.on('data', (data) => {
    console.error(`[PYTHON ERROR] ${data.toString().trim()}`);
  });

  // Handle unexpected daemon exit.
  pythonDaemonProcess.on('close', (code) => {
    console.log(`[MAIN] Python telemetry engine exited with code ${code}`);
  });
}

/**
 * Terminates the supervised Python daemon cleanly on application quit.
 */
function stopPythonDaemon() {
  if (pythonDaemonProcess) {
    console.log('[MAIN] Stopping Python telemetry engine...');
    pythonDaemonProcess.kill('SIGTERM');
    pythonDaemonProcess = null;
  }
}

/**
 * Creates the primary desktop browser window with security hardening.
 */
function createWindow() {
  console.log('[MAIN] Creating primary frameless desktop window...');
  // Configure Content-Security-Policy header rules on the default session.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:* ws://localhost:* http://localhost:*; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"
        ]
      }
    });
  });

  // Create BrowserWindow instance with customized window dimensions and framing.
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    frame: false, // Frameless design to allow custom cyber titlebar
    backgroundColor: '#090d16',
    show: false, // Hidden until ready-to-show to prevent white flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, // Hard isolation between preload and renderer JS
      nodeIntegration: false, // Prevent renderer access to Node built-ins
      sandbox: true // Chromium sandbox enforcement
    }
  });

  // Load either Vite development server URL or built static HTML bundle.
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Display window smoothly once layout is primed.
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Intercept and block unauthorized new window popups.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Intercept and block unauthorized top-level navigations.
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== 'http://localhost:5173' && parsedUrl.protocol !== 'file:') {
      event.preventDefault();
    }
  });

  // Dereference window object when closed.
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Initializes the native system tray icon and context menu.
 */
function createTray() {
  // Use a fallback or create tray context menu.
  try {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'NetWhisper Monitor',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Show Dashboard',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      {
        label: 'Minimize to Tray',
        click: () => {
          if (mainWindow) {
            mainWindow.hide();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Quit NetWhisper',
        click: () => {
          app.quit();
        }
      }
    ]);

    // Note: If an icon file is present, tray can be initialized.
    // In headless or test setups without X display icon assets, catch cleanly.
  } catch (err) {
    console.log('[TRAY] System tray initialization deferred.');
  }
}

// Register IPC handlers for desktop titlebar actions.
ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

// Register IPC handler for native log export.
ipcMain.handle('export:logs', async (event, jsonData) => {
  if (!mainWindow) return { success: false, error: 'No active window' };
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export NetWhisper Telemetry Log',
    defaultPath: `netwhisper-telemetry-${Date.now()}.json`,
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });

  if (filePath) {
    require('fs').writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf8');
    return { success: true, filePath };
  }
  return { success: false, cancelled: true };
});

// Register IPC handler for native notifications.
ipcMain.on('notify:alert', (event, { title, message }) => {
  if (Notification.isSupported()) {
    new Notification({
      title: title || 'NetWhisper Privacy Alert',
      body: message || 'High-risk background network activity detected.',
      silent: false
    }).show();
  }
});

// Register IPC handler for opening external URLs safely.
ipcMain.handle('open:external', async (event, url) => {
  if (typeof url === 'string' && url.startsWith('https://')) {
    await shell.openExternal(url);
    return { success: true };
  }
  return { success: false, error: 'Blocked non-https URL' };
});

// App lifecycle: Ready event.
app.whenReady().then(() => {
  startPythonDaemon();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// App lifecycle: Clean shutdown.
app.on('will-quit', () => {
  stopPythonDaemon();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
