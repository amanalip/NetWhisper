# NetWhisper: Phase 3 Implementation Guide

This document records the implementation of Phase 3: Electron Desktop Shell and IPC Layer.

![NetWhisper Real Application Interface](app_ui_actual.png)

---

## 1. Overview of Phase 3 Deliverables

Phase 3 established the native Electron desktop shell, custom frameless windowing, system tray integration, desktop notifications, background daemon supervision, and a hardened IPC ContextBridge.

Every line of code in the Electron scripts contains comprehensive comments for clarity.

---

## 2. Component Implementation Details

### 2.1 Main Process Supervisor (`electron/main.cjs`)
- **Daemon Lifecycle Management**:
  - Automatically locates the Python binary inside `.venv/bin/python3` and spawns `server/main.py` as a managed child process on application launch.
  - Automatically transmits `SIGTERM` to the child daemon on application quit to ensure clean process cleanup.
- **Frameless Window Management**:
  - Creates a native `BrowserWindow` with `frame: false` to allow custom cyber title bar controls.
  - Configures dark background `#090d16` with smooth `ready-to-show` rendering to prevent white flash.
- **Security Hardening Flags**:
  - Configures `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
  - Configures Content Security Policy (CSP) headers intercepting network responses via `session.defaultSession.webRequest.onHeadersReceived`.
  - Blocks unauthorized popup windows and restricts external links to validated `https:` URLs opened via `shell.openExternal`.
- **System Tray Integration**:
  - Provides a system tray menu with quick actions (Show Dashboard, Minimize to Tray, Quit).
- **IPC Handlers**:
  - Window controls (`window:minimize`, `window:maximize`, `window:close`).
  - Native save dialog (`export:logs`) for writing JSON telemetry logs.
  - Desktop notification alerts (`notify:alert`) for high-risk telemetry detections.

### 2.2 Preload IPC Boundary (`electron/preload.cjs`)
- Uses `contextBridge.exposeInMainWorld('electronAPI', ...)` to expose explicit, typed channels.
- Completely encapsulates `ipcRenderer` and prevents exposing raw Node.js modules (`child_process`, `fs`, `eval`) to the renderer.

---

## 3. Technology and File Summary

| File | Purpose | Key Dependencies |
| :--- | :--- | :--- |
| `electron/main.cjs` | Desktop window, tray, daemon lifecycle, and security boundaries | `electron`, `child_process`, `path` |
| `electron/preload.cjs` | Hardened ContextBridge IPC layer | `electron` |
| `package.json` | Project scripts and Electron execution targets | `electron`, `vite`, `react` |
