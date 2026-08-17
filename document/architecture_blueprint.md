# Architecture Blueprint: NetWhisper

This document provides a comprehensive technical blueprint of NetWhisper. It details every architectural layer, component interaction, data flow, Linux kernel socket mechanism, security boundary, and technology selection with explicit technical rationales.

---

## 1. System Context and Objective

NetWhisper is a local privacy and network telemetry monitor designed to inspect, correlate, and visualize background network socket activity from running desktop applications, CLI utilities, background services, and local scripts.

### 1.1 Core Problems Addressed
1. **Opaque Background Telemetry**: Modern desktop applications and CLI tools frequently transmit analytics, crash reports, and usage metrics in the background without user visibility.
2. **Disconnected Socket Visibility**: Standard system tools (such as basic task managers) show process CPU and memory but fail to correlate active network sockets to specific process hierarchies in real time.
3. **Lack of Granular Control**: Users rarely have a quick method to isolate a single noisy process or terminate rogue background beacons without interrupting the entire system network interface.

### 1.2 High-Level Architecture Diagram

```
+---------------------------------------------------------------------------------------+
|                               Electron Desktop Shell                                  |
|                                                                                       |
|  +-------------------------------------+     +-------------------------------------+  |
|  |     Electron Main Process           |     |     Preload IPC Boundary            |  |
|  |  - Lifecycle Management             |     |  - contextIsolation: true           |  |
|  |  - Native Window & Framing          |     |  - nodeIntegration: false           |  |
|  |  - System Tray & Notifications      |     |  - sandbox: true                    |  |
|  |  - Child Process Daemon Supervisor  |     |  - Explicit Typed Channel Bridge    |  |
|  +-------------------------------------+     +-------------------------------------+  |
|                                        \     /                                        |
|                                         \   /                                         |
|  +---------------------------------------------------------------------------------+  |
|  |                        React + Vite Desktop Renderer                            |  |
|  |  +---------------------------+  +--------------------------------------------+  |  |
|  |  | Process Socket Tree View  |  | Domain & Telemetry Breakdown Matrix        |  |  |
|  |  | - Hierarchical grouping   |  | - Reverse DNS and service classification   |  |  |
|  |  | - Per-PID state badges    |  | - Privacy risk scoring (Low to Critical)   |  |  |
|  |  +---------------------------+  +--------------------------------------------+  |  |
|  |  +---------------------------+  +--------------------------------------------+  |  |
|  |  | Canvas Activity Heatmap   |  | Instant Sandboxing & Kill Switches         |  |  |
|  |  | - Time vs Process/Port    |  | - One-click SIGTERM/SIGKILL                |  |  |
|  |  | - Live throughput wave    |  | - Traffic isolate & Panic switch           |  |  |
|  |  +---------------------------+  +--------------------------------------------+  |  |
|  +---------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------+
                                           |
                                           | WebSocket (/ws/traffic) & REST (/api/*)
                                           | Strictly bound to loopback 127.0.0.1
                                           v
+---------------------------------------------------------------------------------------+
|                       NetWhisper Telemetry Daemon (Python)                            |
|                                                                                       |
|  +---------------------------------------------------------------------------------+  |
|  | Socket Extraction & Correlation Engine                                          |  |
|  | - Reads /proc/net/tcp, /proc/net/udp, /proc/net/tcp6, /proc/net/udp6            |  |
|  | - Extracts socket inodes (socket:[inode]) and maps to /proc/[pid]/fd            |  |
|  | - Resolves process trees, parent PIDs, user context, CPU, and memory stats      |  |
|  | - Zero-privilege fallback via 'ss -tupa -H -O' when /proc access is restricted  |  |
|  +---------------------------------------------------------------------------------+  |
|                                          |                                            |
|                    +---------------------+---------------------+                      |
|                    |                                           |                      |
|  +------------------------------------+     +--------------------------------------+  |
|  | Privacy & Risk Analysis Engine     |     | Sandbox & Process Control Manager    |  |
|  | - Async reverse DNS resolver       |     | - System PID protection whitelist    |  |
|  | - In-memory TTL cache              |     | - Signal-based process termination   |  |
|  | - Telemetry & tracker signature DB |     | - Network isolation mock controller  |  |
|  | - Command line credential scrubber |     | - Strict integer input validation    |  |
|  +------------------------------------+     +--------------------------------------+  |
|                    |                                           |                      |
|  +---------------------------------------------------------------------------------+  |
|  | Scenario Simulation Injector (Dual Mode Engine)                                 |  |
|  | - Injects synthetic CLI beacons, tracker sockets, and cloud sync events         |  |
|  | - Allows UI testing and feature verification without elevated root permissions  |  |
|  +---------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                                    Linux Kernel                                       |
|  - Virtual procfs filesystem (/proc)           - POSIX Signals (SIGTERM, SIGKILL)     |
|  - Network Socket Tables (AF_INET, AF_INET6)   - Loopback Network Interface (lo)      |
+---------------------------------------------------------------------------------------+
```

---

## 2. Detailed Technical Breakdown by Layer

### 2.1 Linux Kernel & Socket Inspection Layer

#### 2.1.1 Mechanisms Used
Linux exposes kernel network socket tables through the `/proc` virtual filesystem:
- `/proc/net/tcp` and `/proc/net/tcp6`: Active IPv4 and IPv6 TCP sockets.
- `/proc/net/udp` and `/proc/net/udp6`: Active IPv4 and IPv6 UDP sockets.
- `/proc/[pid]/fd/*`: File descriptors associated with running processes.

#### 2.1.2 Low-Level Socket Parsing Logic
1. **Address Parsing**: `/proc/net/tcp` stores IP addresses and ports in little-endian hexadecimal format (for example, `0100007F:0050` corresponds to `127.0.0.1:80`). The engine converts these hex representations into standard dotted-decimal strings and integer port numbers.
2. **Connection State Mapping**: Sockets contain hex state codes mapped to TCP lifecycle states:
   - `01`: `ESTABLISHED`
   - `02`: `SYN_SENT`
   - `03`: `SYN_RECV`
   - `0A`: `LISTEN`
   - `06`: `TIME_WAIT`
   - `07`: `CLOSE`
   - `08`: `CLOSE_WAIT`
3. **Inode to PID Correlation**: Each socket record has an `inode` field. In `/proc/[pid]/fd/`, socket file descriptors exist as symlinks pointing to targets formatted as `socket:[<inode>]`. By scanning `/proc/[pid]/fd/`, the engine constructs a reverse lookup map from `inode` to `PID`.
4. **Resilient Fallback via `ss`**: On distributions where `/proc/[pid]/fd` permissions are restricted for unprivileged users, the engine executes `ss -tupa -H -O` using non-blocking asynchronous subprocesses to retrieve socket-to-process bindings without requiring elevated root permissions.

#### 2.1.3 Technical Rationale
- **Why ProcFS and `ss` instead of raw eBPF (tc/kprobes)?**
  While eBPF offers high precision, it requires root permissions (`CAP_SYS_ADMIN` or `CAP_BPF`), specific kernel headers, and kernel version >= 5.8. Relying solely on eBPF would prevent standard desktop users from running NetWhisper. The ProcFS and `ss` architecture delivers real-time visibility across all Linux distributions out of the box with zero specialized kernel module dependencies.

---

### 2.2 Telemetry & Privacy Analysis Engine

#### 2.2.1 Reverse DNS and Endpoint Classification
When a socket connects to an external IP, the privacy engine performs non-blocking reverse DNS lookups.
- **In-Memory TTL Cache**: Prevents DNS query amplification and avoids blocking the event loop. Resolved hostnames are cached with a configurable TTL (default: 300 seconds).
- **Service Classification Matrix**:
  - `Telemetry & Analytics`: Domains matching signatures like `telemetry.*`, `analytics.*`, `*.sentry.io`, `*.mixpanel.com`, `*.vortex.data.microsoft.com`.
  - `Cloud Infrastructure`: Endpoints resolving to AWS, Google Cloud, Cloudflare, Azure, Fastly.
  - `Content Delivery`: CDNs delivering static assets and media streams.
  - `Trackers & Ads`: Ad networks and behavioral profiling domains.
  - `Direct IP / Suspicious`: Unresolved raw IPs or connections to non-standard ports (such as raw TCP on port 4444 or 8888).

#### 2.2.2 Privacy Risk Scoring Algorithm
Each process is assigned a computed Risk Score:
- **Critical Risk**: Unencrypted plaintext communication on non-standard ports + active telemetry beaconing.
- **High Risk**: Unidentified background CLI process making high-frequency outbound connections to analytics endpoints.
- **Medium Risk**: Known application (e.g. IDE or browser) transmitting periodic background telemetry over TLS.
- **Low Risk**: Standard user-initiated encrypted HTTPS/TLS 1.3 connections or local loopback communications.

#### 2.2.3 Secret and Credential Redaction Engine
CLI utilities frequently contain credentials in command line arguments (e.g. `curl -H "Authorization: Bearer xyz"` or `aws --access-key=AKIA...`).
- Before any process command line or environment metadata is passed to the WebSocket or UI, it passes through a regex redaction pipeline.
- Redacts JWT tokens (`eyJ...`), Bearer headers, AWS keys (`AKIA...`), basic auth credentials, passwords, and GitHub tokens (`ghp_...`).

---

### 2.3 Process Sandboxing and Safeguards

#### 2.3.1 Process Termination Mechanics
- Process termination is executed via native POSIX signals using Python `os.kill(int(pid), signal.SIGTERM)` for graceful termination, followed by `signal.SIGKILL` if the process fails to terminate within a timeout.
- Shell interpolation (such as `os.system("kill " + pid)`) is strictly avoided to eliminate command injection vectors.

#### 2.3.2 Immutable System PID Safeguards
To guarantee system stability, the engine maintains an immutable whitelist:
- **PID <= 1**: PID 0 and PID 1 (`init` / `systemd`) cannot be signaled.
- **Kernel Daemons**: PIDs with empty command lines or running under kthreadd are blocked.
- **Display Servers**: Processes matching `Xorg`, `wayland`, `sway`, `gnome-shell`, `kwin` cannot be terminated.
- **NetWhisper Self-Protection**: NetWhisper's own backend and Electron PIDs cannot be targeted by kill or isolate requests.

#### 2.3.3 Dual Mode Engine (Live Kernel vs Scenario Simulation)
- **Live Kernel Mode**: Inspects real local processes and sockets on the host Linux machine.
- **Scenario Simulation Mode**: Injects realistic background traffic (synthetic CLI tools beaconing, electron app telemetry, package manager updates) to allow testing, demonstration, and security evaluation without requiring live malicious activity.

---

### 2.4 Electron Desktop Layer & Security Hardening

#### 2.4.1 Component Roles
- `electron/main.cjs`: Manages native desktop window creation, custom frameless styling, system tray icon with quick menus, child daemon lifecycle supervision, and desktop notification dispatch.
- `electron/preload.cjs`: Hardened context bridge exposing a minimal, typed `window.electronAPI` interface to the renderer.

#### 2.4.2 Security Hardening Checklist
1. `contextIsolation: true`: Enforces a hard separation between the renderer JavaScript context and the Node.js execution environment.
2. `nodeIntegration: false`: Prevents the renderer from directly accessing `require`, `process`, or native Node modules.
3. `sandbox: true`: Runs the renderer within Chromium's operating system level sandbox.
4. **Strict Content Security Policy (CSP)**:
   ```
   default-src 'self';
   script-src 'self';
   connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:*;
   style-src 'self' 'unsafe-inline';
   img-src 'self' data:;
   ```
5. **Navigation Interception**: Handlers on `will-navigate` and `setWindowOpenHandler` block arbitrary redirects and restrict external link handling to validated `https:` URLs opened via `shell.openExternal`.

---

### 2.5 Frontend Desktop User Interface

#### 2.5.1 Technology Choice & Rationale
- **React 18 + Vite**:
  - *Why*: Delivers lightning-fast hot module reloading during development, tiny production bundle footprints, and fine-grained state updates necessary for handling 10Hz socket diff streams.
- **HTML5 Canvas API for Heatmaps**:
  - *Why*: Rendering hundreds of animated packet transfer blocks in the DOM creates garbage collection pauses and frame drops. HTML5 Canvas renders the 2D Packet Volume Heatmap and bandwidth waveforms directly on the GPU canvas with consistent 60 FPS performance.
- **Lucide Icons**:
  - *Why*: Lightweight SVG icons for protocols, status indicators, and process categories without external font overhead.

#### 2.5.2 Key UI Components
1. `TitleBar.jsx`: Frameless desktop title bar with custom minimize, maximize, close controls, and connection status indicator.
2. `ProcessSocketTree.jsx`: Hierarchical tree organizing sockets by parent process and child threads, displaying protocol badges, port numbers, connection states, and quick-action buttons.
3. `DomainBreakdown.jsx`: Interactive matrix classifying contacted domains, DNS query latency, and telemetry risk levels.
4. `PacketHeatmap.jsx`: 2D timeline heatmap displaying packet bursts, recurring beacons, and throughput velocity.
5. `NetworkWaterfall.jsx`: High-speed event stream capturing new sockets, closed connections, and sandboxing interventions with pause/resume and PCAP/JSON export.
6. `ProcessDetailModal.jsx`: Deep-dive drawer displaying socket buffer utilization, file descriptors, sanitized environment variables, and process ancestry.
7. `GlobalControls.jsx`: Engine mode toggle, Global Panic Button, search filters, and auto-isolation rules.

---

## 3. Communication Protocols and Data Schemas

### 3.1 REST API Endpoints (Localhost 127.0.0.1)

#### `GET /api/status`
Returns daemon health, operating mode, and aggregate socket metrics.
```json
{
  "status": "online",
  "mode": "live",
  "uptime_seconds": 1284,
  "stats": {
    "total_processes": 54,
    "active_sockets": 112,
    "bandwidth_in_bps": 24500,
    "bandwidth_out_bps": 12800,
    "telemetry_sockets": 9
  }
}
```

#### `POST /api/sandbox/kill`
Terminates a process by PID.
```json
// Request
{
  "pid": 3412,
  "signal": "SIGTERM"
}

// Response
{
  "success": true,
  "pid": 3412,
  "message": "Process 3412 successfully terminated"
}
```

#### `POST /api/sandbox/isolate`
Toggles network isolation state for a process.
```json
// Request
{
  "pid": 3412,
  "isolate": true
}

// Response
{
  "success": true,
  "pid": 3412,
  "is_isolated": true
}
```

#### `POST /api/mode`
Switches between `live` and `simulation` modes.
```json
// Request
{
  "mode": "simulation"
}

// Response
{
  "success": true,
  "active_mode": "simulation"
}
```

#### `POST /api/panic`
Triggers the global panic kill switch to freeze or isolate untrusted background outbound connections.

---

### 3.2 WebSocket Streaming Protocol (`/ws/traffic`)

The WebSocket stream emits periodic state updates and discrete socket events at 10Hz:

```json
{
  "type": "telemetry_tick",
  "timestamp": 1771308200.45,
  "metrics": {
    "bandwidth_in": 18240,
    "bandwidth_out": 9410,
    "active_sockets_count": 86,
    "high_risk_count": 2
  },
  "processes": [
    {
      "pid": 4120,
      "ppid": 1200,
      "name": "code",
      "cmdline": "/usr/share/code/code --no-sandbox",
      "category": "developer_tool",
      "cpu_percent": 1.4,
      "memory_mb": 248.5,
      "risk_score": "medium",
      "is_isolated": false,
      "sockets": [
        {
          "inode": 98214,
          "proto": "TCP",
          "local_address": "192.168.1.50:48210",
          "remote_address": "13.107.42.16:443",
          "remote_domain": "telemetry.remote.visualstudio.com",
          "state": "ESTABLISHED",
          "category": "Telemetry & Analytics",
          "bytes_sent": 8192,
          "bytes_recv": 2048,
          "is_encrypted": true,
          "risk": "medium"
        }
      ]
    }
  ],
  "heatmap_slice": {
    "timestamp": 1771308200,
    "categories": {
      "telemetry": 8,
      "cloud_api": 14,
      "browser": 32,
      "cli": 5
    }
  }
}
```

---

## 4. Automated Testing and Verification Strategy

To guarantee reliability, safety, and security, NetWhisper includes a multi-tier test suite:

### 4.1 Backend Security & Integrity Test Suite (`tests/test_security.py`)
- **PID Fuzzing & Injection Test**: Sends negative numbers, non-integer strings, null bytes, and path traversal strings to verify immediate rejection with `400 Bad Request`.
- **System PID Safeguard Test**: Asserts that kill or isolate requests targeting PID 0, PID 1, or protected system PIDs fail with `403 Forbidden`.
- **Secret Redaction Test**: Runs test command lines containing mock API tokens, AWS keys, and passwords through the sanitizer to assert zero credential leakage.
- **Socket Parsing Bounds Test**: Validates that malformed `/proc/net/tcp` entries do not raise unhandled exceptions or crash the daemon.
- **Loopback Enforcement Test**: Confirms that FastAPI servers bind strictly to `127.0.0.1`.

### 4.2 Electron Security Audit (`tests/test_electron_security.test.js`)
- **WebPreferences Audit**: Asserts that `contextIsolation === true`, `nodeIntegration === false`, and `sandbox === true`.
- **CSP Compliance Check**: Validates that Content-Security-Policy headers forbid remote scripts and disallow wildcard origins.
- **IPC Boundary Verification**: Confirms that `preload.cjs` exposes only strictly typed methods and does not expose `ipcRenderer` or Node built-in modules.

---

## 5. Technology Selection Rationale Summary

| Component | Selected Technology | Alternative Considered | Technical Rationale for Selection |
| :--- | :--- | :--- | :--- |
| **Desktop Shell** | Electron (v30+) | Tauri / PyWebView | Full cross-platform support, mature frameless window controls, reliable system tray menus, and native notifications. |
| **Frontend Framework** | React 18 + Vite | Vanilla JS / Next.js | High-performance virtual DOM diffing for 10Hz socket trees with fast HMR and zero SSR bloat. |
| **Heatmap Visualization** | HTML5 Canvas API | DOM Divs / SVG | Direct GPU rendering avoiding DOM node overhead and garbage collection stutter during high-frequency throughput streaming. |
| **Backend Daemon** | Python 3.10+ | Go / Rust | Direct, zero-compilation access to Linux procfs, POSIX signals, and asynchronous WebSockets via FastAPI. |
| **Socket Inspection** | ProcFS + `ss` Fallback | eBPF (tc/kprobes) | Works out of the box on all Linux kernels without requiring root privileges (`CAP_SYS_ADMIN` or `CAP_BPF`) or kernel headers. |
| **Process Management** | Native `os.kill` | Shell `kill` commands | Eliminates shell injection vulnerabilities through direct POSIX syscalls with strict integer typing. |
