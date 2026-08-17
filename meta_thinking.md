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

## 2. Key Architectural Decisions

### Packaging Choice: Pure Electron Desktop App
- **Options Evaluated**:
  1. Hybrid Desktop and Web (FastAPI backend + React UI + standalone browser access).
  2. Pure Electron Desktop App (Bundled desktop application with native system tray and window framing).
  3. Lightweight Web Dashboard (Browser-only interface).
- **Selected Decision**: Pure Electron Desktop App.
- **Rationale**: Provides native OS window control, system tray presence, desktop notification dispatch for high-risk background beaconing, and direct process lifecycle management.

### Telemetry and Kernel Inspection Architecture
- **Decision**: Python backend (FastAPI / Uvicorn) combined with Linux procfs (`/proc/net/tcp`, `/proc/net/udp`, `/proc/[pid]/fd`) and `ss` tools, paired with a React and Vite frontend.
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

## 5. Execution Roadmap

1. [x] Documentation and Architecture Blueprint (`README.md`, `document/architecture_blueprint.md`, `meta_thinking.md`).
2. [ ] Backend Engine (`server/main.py`, `socket_engine.py`, `privacy_analyzer.py`, `sandbox_manager.py`, `scenario_generator.py`).
3. [ ] Security Test Suites (`tests/test_security.py`, `tests/test_electron_security.test.js`).
4. [ ] Electron Layer (`electron/main.cjs`, `electron/preload.cjs`).
5. [ ] Frontend Desktop UI (`src/components/`, `index.css`, Canvas Heatmap, Socket Tree).
6. [ ] Verification and End-to-End Validation.
