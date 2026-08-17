# NetWhisper: Conversation and Decision Log (Meta Thinking)

This file tracks the core context, key decisions, architectural trade-offs, and progress across conversations.

---

## 1. Project Inception and Concept

- **Core Concept**: An interactive privacy and networking monitor that visualizes desktop applications and CLI tools making background network requests.
- **Key Features Identified**:
  - Real-time process socket tree (hierarchical process-to-socket mapping).
  - Domain resolution breakdown (reverse DNS and telemetry endpoint categorization).
  - Instant per-process network sandboxing and kill switches.
  - Packet volume heatmaps and activity waterfall.
- **Repository**: `NetWhisper` (Per-Process Outbound Socket and Telemetry Watcher).

---

## 2. Key Architectural Decisions and Rationales

### Packaging Choice: Pure Electron Desktop App
- **Options Evaluated**:
  1. Hybrid Desktop and Web (FastAPI backend + React UI + standalone browser access).
  2. Pure Electron Desktop App (Bundled desktop application with native system tray and window framing).
  3. Lightweight Web Dashboard (Browser-only interface).
- **Selected Decision**: Pure Electron Desktop App.
- **Rationale**: Provides native OS window control, system tray presence, desktop notification dispatch for high-risk background beaconing, and direct process lifecycle management.

### Socket Inspection Strategy: ProcFS + `ss` Fallback vs eBPF
- **Evaluated Alternatives**: eBPF (tc/kprobes) vs ProcFS (`/proc/net/*`, `/proc/[pid]/fd`) with `ss` fallback.
- **Decision**: ProcFS + `ss` fallback.
- **Rationale**: While eBPF offers high precision, it requires root permissions (`CAP_SYS_ADMIN` or `CAP_BPF`), specific kernel headers, and kernel versions >= 5.8. ProcFS and `ss` work out of the box for standard desktop users on any Linux distribution without elevated privileges or specialized toolchains.

### Heatmap Visualization: HTML5 Canvas vs SVG/DOM
- **Evaluated Alternatives**: SVG elements, standard DOM divs, HTML5 Canvas.
- **Decision**: HTML5 Canvas API.
- **Rationale**: High-throughput 10Hz socket telemetry updates generate hundreds of data points per second. Rendering these in the DOM causes layout thrashing and garbage collection pauses. Canvas renders directly to the GPU buffer at a smooth 60 FPS.

### Telemetry and Kernel Inspection Architecture
- **Decision**: Python backend (FastAPI / Uvicorn) combined with Linux procfs and `ss` tools, paired with a React and Vite frontend.
- **Dual Mode Design**:
  1. *Live Linux Kernel Mode*: Correlates real local sockets to active OS processes via socket inodes.
  2. *Scenario Simulation Mode*: Simulates rich network activity (background telemetry, CLI beacons, tracker endpoints) to test features and UI responses without requiring root permissions.

---

## 3. Security Requirements and Hardening Rules

- **Strict Electron Hardening**:
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `sandbox: true`
  - Explicit Content Security Policy (CSP) blocking unauthorized script injection and remote origins.
  - External link whitelist handling (`https:` only via `shell.openExternal`).
- **Backend and OS Level Safeguards**:
  - Localhost binding (`127.0.0.1` only).
  - System PID Protection Whitelist (PID 0, PID 1, display servers, and NetWhisper's own process cannot be terminated or isolated).
  - Strict integer validation on all PID inputs to prevent command injection.
  - Secret scrubber to mask tokens, passwords, and API keys from process command lines before sending to the UI.
- **Automated Security Test Suite**:
  - `test_security.py`: Backend fuzzing, PID bounds, and secret redaction.
  - `test_electron_security.test.js`: WebPreferences and CSP header audit.

---

## 4. Documentation and Tone Standards

- **Writing Guidelines**:
  - Zero em dashes (`—`) or en dashes (`–`).
  - Plain, direct, technical language.
  - No formulaic AI buzzwords or filler adjectives.
  - Fact-checked technical details regarding Linux networking and Electron security settings.

---

## 5. Execution Roadmap: 5-Phase Implementation Strategy

1. **Phase 1: Backend Core and Telemetry Engine**
   - Socket collector (`/proc/net/*`, `/proc/[pid]/fd`, `ss` fallback).
   - Privacy analyzer, reverse DNS cache, and secret redaction engine.
   - Sandbox manager with immutable system PID protection.
   - Scenario simulation injector for rich testing.
   - FastAPI server with REST endpoints and 10Hz WebSocket streaming.

2. **Phase 2: Automated Security and Reliability Test Suite**
   - Backend security test suite (`tests/test_security.py`): PID fuzzing, protected PID isolation, secret scrubbing, loopback binding.
   - Electron security audit suite (`tests/test_electron_security.test.js`): webPreferences, CSP compliance, IPC boundaries.

3. **Phase 3: Electron Desktop Shell and IPC Layer**
   - `electron/main.cjs`: Native frameless window, system tray menu, notification dispatcher, background daemon supervisor.
   - `electron/preload.cjs`: Hardened context bridge with typed IPC APIs.

4. **Phase 4: Frontend Desktop User Interface and Visualizations**
   - Base styling (`src/index.css`) with glassmorphism dark theme.
   - UI components (`TitleBar`, `ProcessSocketTree`, `DomainBreakdown`, `PacketHeatmap`, `NetworkWaterfall`, `ProcessDetailModal`, `GlobalControls`).
   - React app assembly and WebSocket client integration.

5. **Phase 5: End-to-End Integration, Validation, and Packaging**
   - Live end-to-end testing across Live Kernel and Simulation modes.
   - Verification of kill switches, bandwidth heatmaps, and background telemetry alerts.
   - Final documentation synchronization and walkthrough.

---

## 6. Repository Artifacts Created
- `README.md`: Project overview, features, and quick start.
- `document/architecture_blueprint.md`: Detailed architecture blueprint, technical rationales, and schemas.
- `implementation_plan.md`: 5-phase execution plan and verification strategy.
- `meta_thinking.md`: Decision log and tracking.
