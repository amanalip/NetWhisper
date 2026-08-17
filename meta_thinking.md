# NetWhisper: Conversation and Decision Log (Meta Thinking)

This file tracks the core context, key decisions, architectural trade-offs, and progress across conversations.

---

## 1. Project Inception and Concept

- **Core Concept**: An interactive privacy and networking monitor that visualizes desktop applications and CLI tools making background network requests on Linux.
- **Key Features Identified**:
  - Real-time process socket tree (hierarchical process-to-socket mapping from live host kernel tables).
  - Domain resolution breakdown (reverse DNS and telemetry endpoint categorization).
  - Instant per-process network sandboxing and kill switches.
  - Packet volume heatmaps and activity waterfall.
- **Repository**: `NetWhisper` (Per-Process Outbound Socket and Telemetry Watcher).

---

## 2. Key Architectural Decisions and Rationales

### Packaging Choice: Pure Electron Desktop App
- **Selected Decision**: Pure Electron Desktop App.
- **Rationale**: Provides native OS window control, system tray presence, desktop notification dispatch for high-risk background beaconing, and direct process lifecycle management.

### Socket Inspection Strategy: Live Linux Kernel & Process Table Scanning
- **Primary Mechanism**: Real-time extraction of live host sockets via `psutil` net connections, `/proc/net/tcp`, `/proc/net/udp`, and unprivileged `ss -tupa -H -O -n` fallback.
- **Default Engine Mode**: **Live Linux Kernel Monitoring (`Mode: LIVE`)** is the default operating mode on application launch, inspecting real desktop applications (Chrome, VS Code, Discord, Spotify, CLI utilities) running on the user machine.

### Heatmap Visualization: HTML5 Canvas
- **Rationale**: High-throughput 10Hz socket telemetry updates render smoothly directly to the GPU buffer at 60 FPS without layout thrashing.

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
  - `test_electron_security.test.cjs`: WebPreferences and CSP header audit.

---

## 4. Documentation, Logging, and Code Quality Standards

- **Writing Guidelines**:
  - Zero em dashes (`—`) or en dashes (`–`).
  - Plain, direct, technical language.
  - No formulaic AI buzzwords or filler adjectives.
  - Fact-checked technical details regarding Linux networking and Electron security settings.
- **Line-by-Line Code Commenting**:
  - Every single line of code across the backend, frontend, electron layer, and tests is thoroughly commented for maximum beginner readability and educational clarity.
- **Development Process Logging**:
  - Documented in `document/development/phase_<1-5>/implementation_guide.md`.
- **Testing Process Logging**:
  - Documented in `document/testing/phase_<1-5>/testing_doc.md` logging unit tests, security fuzzing outputs, test commands, and pass/fail metrics.

---

## 5. Execution Status Across All 5 Phases

- [x] **Phase 1: Backend Core and Telemetry Engine** (Live Linux socket extractor, reverse DNS, secret redaction, FastAPI daemon)
- [x] **Phase 2: Automated Security and Reliability Test Suite** (PID fuzzing, protected PID tests, CSP audits)
- [x] **Phase 3: Electron Desktop Shell and IPC Layer** (Native frameless window, system tray, ContextBridge)
- [x] **Phase 4: Frontend Desktop User Interface and Visualizations** (React UI, Canvas heatmaps, live socket tree)
- [x] **Phase 5: End-to-End Integration, Validation, and Packaging** (Verified live Linux socket tracking across real OS processes)
