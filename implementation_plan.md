# Implementation Plan: NetWhisper - 5-Phase Execution Strategy

NetWhisper will be implemented across 5 structured phases to ensure modular development, early security verification, and complete integration.

---

## Architecture Overview

```
+-------------------------------------------------------------------------+
|                        Electron Desktop App                             |
|                                                                         |
|  +--------------------------------+  +-------------------------------+  |
|  |     Electron Main Process      |  |      Preload IPC Bridge       |  |
|  |  (Window, Tray, Process Mgmt)  |  | (ContextIsolation, Strict API)|  |
|  +--------------------------------+  +-------------------------------+  |
|                                   |                                     |
|  +-------------------------------------------------------------------+  |
|  |                 React + Vite Desktop Renderer                     |  |
|  |   - Process Socket Tree            - Domain & Risk Breakdown      |  |
|  |   - Packet Volume Heatmap          - Per-Process Kill Switches    |  |
|  |   - Live Traffic Waterfall         - Deep-Dive Socket Inspector   |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
                                    | (WebSocket / REST on 127.0.0.1)
                                    v
+-------------------------------------------------------------------------+
|                    Local Telemetry Engine (Python)                      |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  | Fast Socket Collector:                                            |  |
|  | - Parses /proc/net/tcp, /proc/net/udp & /proc/[pid]/fd            |  |
|  | - Correlates socket inodes with process metadata and ancestry    |  |
|  +-------------------------------------------------------------------+  |
|                                   |                                     |
|  +--------------------------------+  +-------------------------------+  |
|  |   Privacy & Risk Analyzer      |  |   Sandbox & Kill Manager      |  |
|  |   - Reverse DNS Cache          |  |   - System PID Protection     |  |
|  |   - Secret Redactor            |  |   - Process Termination       |  |
|  |   - Telemetry Signature DB     |  |   - Network Isolation Rules   |  |
|  +--------------------------------+  +-------------------------------+  |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                             Linux Kernel                                |
|  - /proc/net/{tcp,udp,tcp6,udp6}    - Socket Inodes in /proc/[pid]/fd   |
|  - Signals (SIGTERM, SIGKILL)       - Loopback Interface (lo)           |
+-------------------------------------------------------------------------+
```

---

## 5-Phase Implementation Breakdown

### Phase 1: Backend Core and Telemetry Engine
- Set up Python environment and dependencies (`server/requirements.txt`).
- Implement `server/socket_engine.py`:
  - ProcFS `/proc/net/*` parser converting little-endian hex to IP addresses and ports.
  - Inode correlation mapping `/proc/[pid]/fd/` socket references to process IDs.
  - Resilient fallback parser using `ss -tupa -H -O`.
  - Process metadata extraction (command line, CPU, memory, parent PID).
- Implement `server/privacy_analyzer.py`:
  - Asynchronous reverse DNS resolver with TTL caching.
  - Telemetry and analytics signature matcher.
  - Regular expression credential scrubber (masks tokens, passwords, and API keys).
  - Risk scoring algorithm (Low, Medium, High, Critical).
- Implement `server/sandbox_manager.py`:
  - Immutable system PID whitelist (PID 0, PID 1, display servers, and NetWhisper itself).
  - Strict integer validation on all PID inputs.
  - POSIX signal process termination (`SIGTERM` / `SIGKILL`).
  - Network isolation state controller.
- Implement `server/scenario_generator.py`:
  - Telemetry simulation engine generating realistic background CLI beacons, analytics heartbeats, and cloud API traffic.
- Implement `server/main.py`:
  - FastAPI application with REST endpoints (`/api/status`, `/api/sandbox/*`, `/api/mode`, `/api/panic`).
  - 10Hz WebSocket streaming endpoint (`/ws/traffic`).
  - Strict localhost loopback binding (`127.0.0.1`).

### Phase 2: Automated Security and Reliability Test Suite
- Implement `tests/test_security.py`:
  - PID injection and fuzzing test cases.
  - System PID protection tests (PID 0, PID 1, NetWhisper own PID).
  - Secret redaction and credential leakage verification.
  - Malformed ProcFS data resiliency tests.
  - Loopback-only binding tests.
- Implement `tests/test_electron_security.test.js`:
  - WebPreferences configuration audit (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`).
  - Content Security Policy (CSP) header verification.
  - ContextBridge IPC channel whitelist verification.
- Execute all test suites and verify 100% passing status.

### Phase 3: Electron Desktop Shell and IPC Layer
- Configure root `package.json` with scripts and dependencies (`electron`, `react`, `vite`, `lucide-react`).
- Implement `electron/main.cjs`:
  - Frameless native window management with custom styling.
  - System tray icon setup with quick context menu.
  - Background Python daemon supervisor with automatic startup and shutdown.
  - Desktop notification dispatcher for high-risk telemetry detections.
  - IPC handlers for native window actions and file exports.
- Implement `electron/preload.cjs`:
  - Hardened ContextBridge exposing explicit typed APIs (`window.electronAPI`).

### Phase 4: Frontend Desktop User Interface and Visualizations
- Configure `vite.config.js` and `index.html`.
- Implement `src/index.css`:
  - High-polish cyber glassmorphism design system.
  - Custom scrollbars, fluid animations, and responsive flex/grid layouts.
  - Semantic status colors for protocols, risk ratings, and isolation states.
- Implement React components:
  - `TitleBar.jsx`: Frameless desktop window header with status beacon and window controls.
  - `ProcessSocketTree.jsx`: Collapsible process hierarchy with CPU/memory footprint, protocol badges, and per-process action buttons.
  - `DomainBreakdown.jsx`: Telemetry classification matrix and DNS latency tracker.
  - `PacketHeatmap.jsx`: HTML5 Canvas 2D activity heatmap and throughput waveform.
  - `NetworkWaterfall.jsx`: Real-time socket event stream with pause and PCAP/JSON export.
  - `ProcessDetailModal.jsx`: Deep-dive socket drawer and sanitized metadata viewer.
  - `GlobalControls.jsx`: Engine mode switcher, search filter, and Global Panic Button.
- Assemble `src/App.jsx` and `src/main.jsx`.

### Phase 5: End-to-End Integration, Validation, and Packaging
- Execute full build: `npm run build`.
- Launch NetWhisper in Electron desktop mode: `npm run dev` / `npm run electron`.
- Verify real-time Linux socket tracking, scenario traffic simulation, per-process kill switches, and canvas heatmaps.
- Update `meta_thinking.md` and `README.md`.
- Generate final walkthrough report.

---

## Verification Plan

### Automated Verification
- Run backend security tests: `pytest tests/test_security.py`
- Run Electron security tests: `node tests/test_electron_security.test.js`
- Compile frontend bundle: `npm run build`

### Manual Verification
- Test process termination on a dummy process and verify immediate socket removal.
- Test process isolation and observe UI badge updates.
- Test packet volume heatmap rendering at 60 FPS under heavy socket traffic.
- Verify system tray icon controls and notification dispatch on background telemetry detection.
