> **Note: This is a test experiment with Antigravity. Buggy Code, proceed with caution.**

# NetWhisper

> Real-Time Network and Privacy Monitor for Linux Desktop Apps, Browsers, and CLI Tools

NetWhisper is a native Electron desktop application that inspects live outbound network sockets on your Linux system. It maps every TCP/UDP connection to the exact process that opened it, categorizes contacted domains (analytics, telemetry, trackers, CDNs), flags high-risk unencrypted or non-standard-port traffic, and gives you instant kill switches and network isolation per process.

---

## Key Features

- **Live Linux Socket Inspection**: Reads active host sockets directly using `psutil` and `ss` — sees Chrome, VS Code, Discord, npm, pip, and everything else your machine is talking to right now.
- **Process Socket Tree**: Hierarchical view mapping every TCP/UDP connection to its parent process with CPU/RAM usage and connection state.
- **Domain Breakdown**: Reverse DNS resolution and destination categorization (Analytics/Telemetry, Cloud APIs, Trackers, Unencrypted HTTP, Direct IP).
- **Per-Process Kill and Isolate**: One-click SIGTERM/SIGKILL, traffic isolation, and a global Panic Switch that cuts all non-system processes simultaneously.
- **Packet Heatmap and Event Waterfall**: Canvas-rendered 2D activity heatmap and live event stream showing new socket connections in real time.
- **Dual Mode**: Switch between Live Linux Kernel inspection and Scenario Simulation (useful for developing and testing without needing root).

---

## Requirements

- Linux (Ubuntu, Fedora, Arch, etc.)
- Node.js v18+
- Python 3.10+

---

## Quick Start (Three Steps)

### Step 1: Install dependencies

```bash
# Install Node/Electron/React dependencies
npm install

# Install Python backend dependencies
python3 -m venv .venv
.venv/bin/pip install -r server/requirements.txt
```

### Step 2: Build the frontend

```bash
npm run build
```

### Step 3: Launch the desktop app

```bash
npm run electron
```

This opens NetWhisper as a native Electron desktop window. The Electron main process automatically starts the Python telemetry daemon in the background, waits for it to be ready, and then loads the UI — no browser involved.

---

## One-Command Launch (build + open)

```bash
npm start
```

This runs `npm run build` and then immediately opens the Electron desktop window.

---

## Scripts Reference

| Command | What it does |
| :--- | :--- |
| `npm start` | Build frontend and launch Electron desktop app |
| `npm run electron` | Launch Electron desktop app (requires `npm run build` first) |
| `npm run build` | Build the React frontend into `dist/` |
| `npm run dev` | Start the Vite dev server only (browser preview, not the desktop app) |
| `npm test` | Run all backend security tests and Electron hardening audit |

---

## Project Layout

```
NetWhisper/
├── electron/              # Electron main process and IPC preload
│   ├── main.cjs           # Window creation, daemon supervisor, tray, IPC handlers
│   └── preload.cjs        # Hardened ContextBridge exposed to renderer
├── server/                # Python FastAPI telemetry backend
│   ├── main.py            # REST + WebSocket server on 127.0.0.1:8765
│   ├── socket_engine.py   # Live Linux socket extraction (psutil + ss + procfs)
│   ├── privacy_analyzer.py# Reverse DNS, telemetry signatures, secret scrubber
│   ├── sandbox_manager.py # Process kill/isolate with system PID safeguards
│   └── scenario_generator.py # Simulated traffic injector for dev/test mode
├── src/                   # React + Vite desktop UI
│   ├── App.jsx            # Root: WebSocket client, tab routing, action handlers
│   ├── index.css          # Cyber dark glassmorphism design system
│   └── components/        # TitleBar, ProcessSocketTree, DomainBreakdown,
│                          # PacketHeatmap (Canvas), NetworkWaterfall, ProcessDetailModal
├── tests/                 # Automated test suite
│   ├── test_phase1_backend.py     # 7 backend unit tests
│   ├── test_security.py           # 5 security fuzzing tests
│   └── test_electron_security.test.cjs  # Electron hardening audit
└── package.json
```

---

## Security

- Electron renderer runs with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Backend binds to `127.0.0.1` only — not accessible from any external network
- PID 0, PID 1, display servers, and NetWhisper itself are permanently protected from kill/isolate
- Process command lines are scrubbed of API keys, tokens, and passwords before display

---

## Run Tests

```bash
npm test
```

Expected output: 12 backend security tests + 2 Electron hardening checks, all passing.

---

## License

GNU General Public License v3.0 (GPL-3.0)
