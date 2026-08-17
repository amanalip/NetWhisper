# NetWhisper: Conversation and Decision Log (Meta Thinking)

This file tracks the core context, key decisions, architectural trade-offs, and progress across conversations.

---

## 1. Project Inception and Concept

- **Core Concept**: An interactive privacy and networking monitor that visualizes desktop applications and CLI tools making background network requests on Linux.
- **Key Features**:
  - Real-time process socket tree (hierarchical process-to-socket mapping from live host kernel tables).
  - Domain resolution breakdown (reverse DNS and telemetry endpoint categorization).
  - Instant per-process network sandboxing, kill switches, and global panic mode.
  - Packet volume heatmaps and activity waterfall.
- **Repository**: `NetWhisper` (Per-Process Outbound Socket and Telemetry Watcher).

---

## 2. Key Architectural Decisions and Implementation

### Packaging Choice: Pure Electron Desktop App
- **Decision**: Bundled native Electron desktop application with frameless custom windowing, tray menu, and supervised Python backend daemon.

### Full Interactivity & Tactile Controls
- **Toast Notification HUD**: Floating non-blocking notification layer giving instant visual confirmation for process kills, isolation, mode changes, rescans, clipboard copies, and log exports.
- **Optimistic State Updates**: UI immediately reflects sandbox isolation/kill actions with automatic rollback on network errors.
- **Process Accordion Controls**: Expand All and Collapse All toolbar buttons with animated chevron cards.
- **Socket Inspector Utilities**: Full clipboard copy buttons (command line, endpoints, domains, JSON) and direct in-drawer action controls.
- **Bidirectional Filtering**: Click-to-filter on domain rows and category cards automatically filters matching process cards.

---

## 3. Automated Test Verification Results

The multi-tier automated test suite verifies 100% test passing across the entire stack:
- **Backend Unit & Regression Tests**: `pytest tests/ -v` (226 tests passed).
- **Electron Security Hardening Audit**: `node tests/test_electron_security.test.cjs` (6 audit suites passed).
- **Frontend UI Component Suite**: `node --test tests/test_frontend_ui.test.cjs` (27 tests passed across 10 suites).
- **E2E Integration Scenarios**: `node --test tests/test_e2e_scenarios.test.cjs` (5 full workflow scenarios passed).
- **Production Bundle**: `npm run build` generates clean production distribution in `dist/`.

---

## 4. Launching the Desktop Application

- **One-Command Build & Launch**: `npm start`
- **Desktop Launch (pre-built)**: `npm run electron`
- **Automated Tests**: `npm test`
