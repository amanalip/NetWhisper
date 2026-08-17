# Project: NetWhisper

## Architecture
NetWhisper is a high-performance Linux network privacy and desktop security monitoring application. It combines an unprivileged Python FastAPI telemetry daemon (running on 127.0.0.1:8765) with a secure Electron desktop shell and a modern React 18 + Vite frontend.

- **Frontend (`src/`)**: React 18 single-page application utilizing Lucide icons, glassmorphic dark-mode CSS tokens, 10Hz WebSocket stream ingestion, and optimistic local state updates.
- **Backend (`server/`)**: FastAPI server providing procfs socket discovery, reverse DNS resolution, credential scrubbing, telemetry classification, and sandbox safeguards.
- **Electron Shell (`electron/`)**: Main process and Preload script enforcing context isolation, Chromium sandbox, CSP header restrictions, and safe ContextBridge IPC APIs.

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|--------|
| F1 | TitleBar Window Controls | Functional minimize, maximize, close via Electron IPC / web fallback | M1 | R1 | DONE |
| F2 | Mode Switch Toggle | Smooth toggle between Live Linux monitoring and Scenario Simulation | M1 | R1 | DONE |
| F3 | Expand & Collapse All Cards | Global toggle buttons in ProcessSocketTree to expand/collapse all process accordions | M1 | R1 | DONE |
| F4 | Process Card Accordions | Individual expand/collapse toggle for each process card | M1 | R1 | DONE |
| F5 | Quick Rescan Button | Global toolbar button triggering immediate snapshot refresh with spin animation | M1 | R1 | DONE |
| F6 | Filter & Search Controls | Text search, category filter pills, risk filter pills, and reset buttons | M1 | R1 | DONE |
| F7 | Toast Notification HUD | Non-blocking floating HUD supporting success, error, warning, info toasts | M2 | R2 | IN_PROGRESS |
| F8 | Optimistic Action Feedback | Instant visual feedback on process kill, isolate, panic toggle, mode switch, export | M2 | R2 | IN_PROGRESS |
| F9 | Socket Inspector Copy Utils | Drawer clipboard copy buttons for Command Line, Remote IP, Domain, and JSON | M2 | R1 | IN_PROGRESS |
| F10 | Socket Inspector Drawer Actions | In-drawer Kill and Isolate process buttons | M2 | R1 | IN_PROGRESS |
| F11 | Kill Confirmation Modal | Interactive modal displaying process details, PID, and command preview | M3 | R3 | PLANNED |
| F12 | Signal Selection (SIGTERM/SIGKILL) | Radio or toggle switch selecting Graceful (SIGTERM) vs Force (SIGKILL) termination | M3 | R3 | PLANNED |
| F13 | System PID Safeguards | Clear visual warning and disabled state for immutable system PIDs (PID <= 1, self, root) | M3 | R3 | PLANNED |
| F14 | Heatmap Stream Controls | Pause/Resume and Clear controls for 2D activity heatmap and canvas waveforms | M3 | R1 | PLANNED |
| F15 | Waterfall Stream Controls | Pause/Resume with frozen event buffer, Clear, and Export JSON logs | M3 | R1 | PLANNED |
| F16 | Domain Click-to-Filter | Clicking domain row in Domain Breakdown filters ProcessSocketTree and routes tab | M4 | R4 | PLANNED |
| F17 | Category Click-to-Filter | Clicking category card in Domain Breakdown filters ProcessSocketTree by category | M4 | R4 | PLANNED |
| F18 | Active Filter Pill & Clear | Breadcrumb/pill showing active cross-tab filter with one-click clear button | M4 | R4 | PLANNED |
| F19 | Panic Mode Banner & Control | Panic switch freezing non-system traffic with prominent warning banner | M4 | R1, R2 | PLANNED |
| F20 | Automated Backend Tests | 100% passing pytest test suite (`pytest tests/ -v`) | M5 | R5 | PLANNED |
| F21 | Automated Electron Security Audit | 100% passing Electron security suite (`npm run test:electron`) | M5 | R5 | PLANNED |
| F22 | Frontend Production Build | Clean Vite build with zero warnings/errors (`npm run build`) | M5 | R5 | PLANNED |
| F23 | Comprehensive E2E Verification | End-to-end verification across all tiers (Tiers 1-5) | M5 | R5 | PLANNED |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | UI Interactivity: Toolbar, Controls & Window Management | Implement TitleBar controls, Mode Switch, Quick Rescan button, Expand/Collapse All buttons, and Search/Filter pills | none | DONE |
| M2 | Toast HUD, Optimistic Feedback & Drawer Copy Utilities | Implement ToastHUD component, optimistic state mutations, clipboard copy utilities, and in-drawer actions | M1 | IN_PROGRESS |
| M3 | Safe Destructive Kill Modal & Canvas Stream Controls | Implement KillConfirmationModal with SIGTERM/SIGKILL selection & PID safeguards; add Pause/Clear controls to Heatmap and Waterfall | M2 | PLANNED |
| M4 | Cross-Tab Bi-Directional Filtering & Panic Mode Integration | Implement click-to-filter on Domain Breakdown rows/cards, deep routing to ProcessSocketTree, active filter pills, and panic banner feedback | M3 | PLANNED |
| M5 | Final Milestone: Full Test Suite Verification & Coverage Hardening | Run and verify 100% pass on pytest, Electron security audit, Vite build, and E2E test suite; harden edge cases | M4 | PLANNED |

## Interface Contracts
### Window Controls ↔ Electron IPC
- `window.electronAPI.minimize()`: Minimizes window.
- `window.electronAPI.maximize()`: Toggles window maximize.
- `window.electronAPI.close()`: Closes window.

### Toast Notification Dispatch
- `addToast({ type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string, duration?: number })`

### Kill Confirmation Modal Props & Dispatch
- `isOpen: boolean`, `process: ProcessItem | null`, `onConfirm: (pid: number, signal: 'SIGTERM' | 'SIGKILL') => void`, `onClose: () => void`
- Safeguards check: `isProtectedPid = pid <= 1 || proc.name in PROTECTED_NAMES || proc.is_system`

### Cross-Tab Navigation & Filter Contract
- `onSelectDomainFilter: (domain: string) => void` -> sets `domainFilter` and switches `activeTab` to `'processes'`
- `onSelectCategoryFilter: (category: string) => void` -> sets `categoryFilter` and switches `activeTab` to `'processes'`
- `onClearFilter: () => void` -> resets filter state

## Code Layout
- `src/App.jsx`: Master container, navigation, global state, toast HUD mounting, modal management.
- `src/components/TitleBar.jsx`: Window controls, application brand, engine status, mode toggle.
- `src/components/GlobalControls.jsx`: Search query, category pills, risk level pills, Quick Rescan button, Panic switch.
- `src/components/ProcessSocketTree.jsx`: Process cards, Expand All / Collapse All buttons, sockets listing, isolate & kill triggers.
- `src/components/ProcessDetailModal.jsx`: Inspector drawer, socket endpoints, telemetry indicators, copy utilities, in-drawer actions.
- `src/components/PacketHeatmap.jsx`: Canvas matrix heatmap, bandwidth waveforms, Pause/Resume, Clear controls.
- `src/components/NetworkWaterfall.jsx`: Scrolling packet waterfall, event buffer pause freezing, Clear, Export JSON.
- `src/components/DomainBreakdown.jsx`: Domain list, category breakdown, click-to-filter navigation triggers.
- `src/components/ToastHUD.jsx`: Floating toast notifications container with animations.
- `src/components/KillConfirmationModal.jsx`: Safe termination confirmation modal with SIGTERM/SIGKILL toggle.
- `src/index.css`: Glassmorphic styling tokens, layout rules, animations, toast and modal styling.
- `server/`: Backend Python FastAPI daemon and engines.
- `tests/`: Automated backend pytest and Electron security test suites.
