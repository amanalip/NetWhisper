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
  - Documented in `document/development/phase_<1-5>/implementation_guide.md` with real application screenshot captures from the live system.
- **Testing Process Logging**:
  - Documented in `document/testing/phase_<1-5>/testing_doc.md` logging unit tests, security fuzzing outputs, test commands, and pass/fail metrics.

---

## 5. Execution Status Across All 5 Phases

- [x] **Phase 1: Backend Core and Telemetry Engine** (Completed & 100% tests passing)
- [x] **Phase 2: Automated Security and Reliability Test Suite** (Completed & 100% security tests passing)
- [x] **Phase 3: Electron Desktop Shell and IPC Layer** (Completed & 100% Electron audits passing)
- [x] **Phase 4: Frontend Desktop User Interface and Visualizations** (Completed & bundle built cleanly)
- [x] **Phase 5: End-to-End Integration, Validation, and Packaging** (Completed & live app screenshot verified)

---

## 6. Complete Repository Artifacts
- `README.md`: Project overview, features, quick start, and testing.
- `implementation_plan.md`: 5-phase execution plan and verification strategy.
- `meta_thinking.md`: Decision log and tracking.
- `document/architecture_blueprint.md`: Detailed architecture blueprint, technical rationales, and schemas.
- `document/development/phase_1/implementation_guide.md`
- `document/testing/phase_1/testing_doc.md`
- `document/development/phase_2/implementation_guide.md`
- `document/testing/phase_2/testing_doc.md`
- `document/development/phase_3/implementation_guide.md`
- `document/testing/phase_3/testing_doc.md`
- `document/development/phase_4/implementation_guide.md`
- `document/testing/phase_4/testing_doc.md`
- `document/development/phase_5/implementation_guide.md`
- `document/testing/phase_5/testing_doc.md`
