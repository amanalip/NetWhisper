# Architecture Blueprint: NetWhisper

This document outlines the technical architecture, design decisions, component interfaces, and technology choices for NetWhisper.

---

## 1. System Overview

NetWhisper is a local privacy and network telemetry monitor designed to detect and visualize background network socket activity from desktop applications and CLI processes.

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

## 2. Technology Stack and Rationale

### Desktop Shell
- **Electron (v30+)**:
  - *Why*: Provides cross-platform desktop integration, native frameless window management, system tray menus, and OS-level notifications for background telemetry alerts.
  - *Security Configuration*: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, custom CSP headers, and explicit IPC channels.

### Frontend
- **React (v18+) and Vite**:
  - *Why*: Fast rendering and lightweight runtime footprint. Ideal for processing high-frequency (10Hz) telemetry updates via WebSocket.
- **HTML5 Canvas API**:
  - *Why*: Used for rendering the 2D Packet Volume Heatmap and live throughput waveforms. Canvas avoids DOM thrashing when displaying hundreds of data points per second.
- **Lucide React**:
  - *Why*: Clean, consistent iconography for protocols, risk levels, and process categories without loading heavy icon font packs.

### Backend Engine
- **Python (v3.10+)**:
  - *Why*: Direct access to Linux procfs, socket parsing, system signal dispatch, and native OS interop without needing heavy compilation chains.
- **FastAPI and Uvicorn**:
  - *Why*: High-throughput asynchronous framework supporting both low-latency WebSockets (`/ws/traffic`) and REST endpoints (`/api/sandbox/*`).
- **Psutil**:
  - *Why*: Cross-verified process tree resolution (PID, parent PID, command line, memory, CPU usage).

---

## 3. Core Engine Mechanics and Fact Checking

### 3.1 Kernel Socket to Process Correlation
Linux maintains socket states in `/proc/net/tcp`, `/proc/net/tcp6`, `/proc/net/udp`, and `/proc/net/udp6`.
1. The engine reads `/proc/net/tcp` to extract local address, remote address, connection state, and socket inode number.
2. Inode numbers are formatted as `socket:[<inode>]`.
3. The engine scans `/proc/[pid]/fd/` symlinks to map the socket inode to its owning Process ID (PID).
4. As a fast fallback and complementary source, the engine can query `ss -tupa -H -O` to resolve sockets with low CPU overhead.

### 3.2 DNS Resolution and Privacy Risk Scoring
- Sockets report raw destination IP addresses. The engine maintains an in-memory TTL-based reverse DNS cache.
- Known telemetry and tracking endpoints (such as telemetry endpoints, crash reporters, analytics collectors, and third-party ad networks) are matched against a local signature database.
- Risk scores (Low, Medium, High, Critical) are assigned based on:
  - Encryption status (plaintext HTTP / unencrypted TCP vs TLS/HTTPS ports).
  - Telemetry endpoint matching.
  - Direct IP connections bypassing domain resolution.
  - Periodic burst beaconing patterns (fixed-interval background heartbeats).

### 3.3 Process Sandboxing and Safeguards
- **Process Termination**: Executed via standard POSIX signals (`SIGTERM` for graceful exit, `SIGKILL` for immediate termination) using `os.kill(int(pid), sig)`.
- **System PID Safeguards**: Hardcoded protection ensures PIDs <= 1, kernel threads, display managers (`Xorg`, `wayland`, `sway`), and NetWhisper's own process tree cannot be killed or isolated.
- **Input Sanitization**: All incoming PID parameters must strictly pass integer parsing and validation before reaching any system call.

---

## 4. IPC and API Interface Specifications

### 4.1 Electron IPC Channels
- `window:minimize`: Minimizes desktop window.
- `window:maximize`: Toggles window maximization.
- `window:close`: Closes or hides window to system tray.
- `export:pcap`: Opens native save dialog to export recorded network events.
- `notify:alert`: Displays a native OS notification on high-risk network detections.

### 4.2 Backend REST Endpoints
- `GET /api/status`: Returns engine status, active mode (live or simulation), and system stats.
- `POST /api/sandbox/kill`: Terminates target process by PID (subject to system whitelist validation).
- `POST /api/sandbox/isolate`: Sets network block status on a process.
- `POST /api/mode`: Toggles between Live Kernel Mode and Scenario Simulation Mode.
- `POST /api/panic`: Triggers global panic mode to stop all untrusted outbound background sockets.

### 4.3 WebSocket Protocol (`/ws/traffic`)
Pushes real-time JSON packets at up to 10Hz:
```json
{
  "timestamp": 1771307200.123,
  "summary": {
    "total_processes": 42,
    "active_sockets": 87,
    "bandwidth_in_bps": 14200,
    "bandwidth_out_bps": 8900,
    "high_risk_count": 3
  },
  "processes": [
    {
      "pid": 2841,
      "ppid": 1402,
      "name": "node",
      "cmdline": "node /opt/cli/telemetry-agent.js",
      "category": "cli",
      "risk_level": "high",
      "is_isolated": false,
      "sockets": [
        {
          "fd": 18,
          "proto": "TCP",
          "local_ip": "192.168.1.10",
          "local_port": 54120,
          "remote_ip": "142.250.190.46",
          "remote_port": 443,
          "remote_host": "telemetry.analytics-service.com",
          "state": "ESTABLISHED",
          "bytes_sent": 4096,
          "bytes_recv": 1024,
          "is_encrypted": true,
          "tag": "Telemetry"
        }
      ]
    }
  ],
  "heatmap_tick": {
    "bucket": "2026-08-17T01:47:00",
    "categories": {
      "telemetry": 14,
      "cloud_api": 8,
      "browser": 22
    }
  }
}
```

---

## 5. Security Model and Boundaries

1. **Renderer Isolation**: The UI has zero access to Node.js APIs or the local filesystem. All actions route through the sanitized `preload.cjs` context bridge.
2. **Localhost Restriction**: The Python daemon binds strictly to `127.0.0.1` and does not accept remote network connections.
3. **Secret Redaction**: Command lines and environment variables are filtered through a regex engine to redact passwords, JWTs, Bearer tokens, and cloud access keys before transmission to the frontend.
