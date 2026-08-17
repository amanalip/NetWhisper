# NetWhisper: Phase 1 Implementation Guide

This document records the design, implementation, and code structure for Phase 1: Backend Core and Telemetry Engine.

![NetWhisper Real Application Interface](app_ui_actual.png)

---

## 1. Overview of Phase 1 Deliverables

Phase 1 established the foundation for NetWhisper's process-to-socket correlation engine and privacy evaluation backend. The components are written in Python and provide real-time socket inspection, TTL-cached DNS resolution, secret scrubbing, and POSIX process control with system safeguards.

Every line of code in Phase 1 has been written with thorough comments for beginner readability and clarity.

---

## 2. Component Implementation Details

### 2.1 Socket Engine (`server/socket_engine.py`)
- **Kernel Socket Parsing**: Reads `/proc/net/tcp`, `/proc/net/tcp6`, `/proc/net/udp`, and `/proc/net/udp6`. Decodes little-endian hexadecimal addresses into standard IPv4/IPv6 strings and integer ports.
- **Inode Mapping**: Scans `/proc/[pid]/fd/*` symlinks matching `socket:[<inode>]` to construct a lookup table from kernel sockets to owning Process IDs.
- **Fallback Resolution**: Executes `ss -tupa -H -O -n` asynchronously to retrieve active socket connections when procfs access is restricted.
- **Process Metadata**: Queries `psutil` for CPU percentage, memory RSS footprint in megabytes, parent PID, user context, and command lines.

### 2.2 Privacy Analyzer and Secret Scrubber (`server/privacy_analyzer.py`)
- **Reverse DNS Resolver**: Uses non-blocking DNS resolution with an in-memory TTL cache (default: 300 seconds) to map remote IP addresses to domain hostnames without stalling the event loop.
- **Signature Classification**: Categorizes destinations into Telemetry & Analytics, Cloud Infrastructure, Unencrypted Web (HTTP), Encrypted Web (HTTPS), and Direct IP.
- **Secret Redactor**: Scrubs sensitive tokens (JWTs, Bearer headers, AWS keys, GitHub tokens, and passwords) from process command lines before transmitting telemetry to the client.
- **Privacy Risk Scoring**: Calculates composite risk scores (`low`, `medium`, `high`, `critical`) for each process based on encryption status, destination type, and non-standard port communications.

### 2.3 Sandbox and Process Controller (`server/sandbox_manager.py`)
- **System PID Safeguards**: Enforces strict protection for PID 0, PID 1 (`init`/`systemd`), kernel threads, display managers (`Xorg`, `wayland`, `sway`), and NetWhisper's own process.
- **POSIX Signal Termination**: Executes `os.kill(int(pid), signal.SIGTERM)` or `signal.SIGKILL` with strict integer validation.
- **Network Isolation State**: Tracks isolated process IDs and manages the global panic state.

### 2.4 Scenario Simulation Injector (`server/scenario_generator.py`)
- Simulates realistic multi-application background traffic (Developer Tools telemetry, CLI beacons, media streaming, and background updaters) with fluctuating byte transfers and burst beaconing patterns.

### 2.5 FastAPI Server (`server/main.py`)
- Binds strictly to localhost loopback `127.0.0.1`.
- Exposes REST endpoints (`/api/status`, `/api/snapshot`, `/api/mode`, `/api/sandbox/kill`, `/api/sandbox/isolate`, `/api/panic`, `/api/events`).
- Exposes WebSocket endpoint `/ws/traffic` streaming 10Hz socket telemetry packets.
