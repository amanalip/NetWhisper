/**
 * Preload Script for NetWhisper Electron Desktop App.
 * Securely bridges native OS capabilities to the renderer using contextBridge.
 * Follows least-privilege principles by restricting exposed channels to explicit typed functions.
 */

// Import contextBridge and ipcRenderer from Electron.
const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe, strictly typed API object to the renderer window context (window.electronAPI).
contextBridge.exposeInMainWorld('electronAPI', {
  // Window management methods.
  minimize: () => {
    // Send asynchronous IPC message to main process to minimize window.
    ipcRenderer.send('window:minimize');
  },

  maximize: () => {
    // Send asynchronous IPC message to main process to toggle maximize/restore.
    ipcRenderer.send('window:maximize');
  },

  close: () => {
    // Send asynchronous IPC message to main process to close/hide window.
    ipcRenderer.send('window:close');
  },

  // Native file export dialog for saving network event logs or packet captures.
  exportLogs: (jsonData) => {
    // Invoke main process save dialog with JSON payload and return promise.
    return ipcRenderer.invoke('export:logs', jsonData);
  },

  // Desktop notification dispatcher for high-risk telemetry detections.
  notifyThreat: (title, message) => {
    // Dispatch alert notification request to main process.
    ipcRenderer.send('notify:alert', { title, message });
  },

  // Safe external URL opener strictly restricted to HTTPS links.
  openExternalUrl: (url) => {
    // Validate protocol before dispatching to main process shell handler.
    if (typeof url === 'string' && url.startsWith('https://')) {
      return ipcRenderer.invoke('open:external', url);
    }
    return Promise.reject(new Error('Invalid URL: Only HTTPS protocols are permitted.'));
  },

  // Query desktop platform name (linux, darwin, win32).
  getPlatform: () => process.platform
});
