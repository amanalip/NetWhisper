# NetWhisper
> Interactive Real-Time Privacy and Network Monitor for Desktop Apps and CLI Tools

NetWhisper visualizes and inspects background network activity across running desktop applications, CLI utilities, background services, and local scripts. It maps outbound sockets to specific processes, breaks down contacted domains and telemetry endpoints, offers instant per-process kill switches and network isolation, and displays high-resolution packet volume heatmaps.

---

## Key Features

- **Real-Time Process Socket Tree**: Live hierarchical view correlating kernel sockets (TCP/UDP) to parent and child processes with CPU/memory metrics and connection states (ESTABLISHED, LISTEN, TIME_WAIT).
- **Domain Resolution and Telemetry Breakdown**: Reverse DNS and destination categorization (Analytics/Telemetry, Cloud APIs, CDNs, Trackers, Direct IP) with privacy risk scoring.
- **Instant Per-Process Sandboxing and Kill Switches**: One-click process termination (SIGKILL/SIGTERM), network traffic isolation, bandwidth throttling, and a global panic button.
- **Packet Volume Heatmaps and Activity Waterfall**: Canvas-based real-time 2D activity heatmap detecting periodic beaconing and burst transfers, paired with a live socket event stream.
- **Security-First Architecture**: Electron hardening (contextIsolation, sandbox, strict CSP), loopback-only binding (127.0.0.1), credential sanitization (redacts API keys and tokens from command lines), and immutable safeguards for critical system PIDs.
- **Dual Engine Modes**:
  - **Live Linux Kernel Mode**: Real-time inspection of active OS processes and `/proc/net` sockets.
  - **Scenario Simulation Mode**: Built-in telemetry injector to explore and test network behaviors safely without requiring elevated permissions.

---

## Architecture

```
NetWhisper/
├── electron/              # Electron main process, tray menu, and IPC preload
├── server/                # Python FastAPI real-time socket engine and privacy analyzer
├── src/                   # React + Vite desktop UI
├── tests/                 # Automated backend and Electron security test suite
└── package.json           # Scripts for dev, test, and desktop bundling
```

---

## Quick Start

### Prerequisites
- Node.js (v18+)
- Python 3.10+

### Setup and Run
```bash
# 1. Install frontend and Electron dependencies
npm install

# 2. Install backend dependencies
pip install -r server/requirements.txt

# 3. Launch NetWhisper Desktop App
npm run dev
```

---

## Security and Quality Verification

Run the automated security and functionality test suite:
```bash
# Run backend security fuzzing and secret redaction tests
pytest tests/test_security.py

# Run Electron security configuration audit
node tests/test_electron_security.test.js
```

---

## License
Licensed under the GNU General Public License v3.0 (GPL-3.0). See [LICENSE](LICENSE) for details.
