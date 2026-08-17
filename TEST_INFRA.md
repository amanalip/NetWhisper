# E2E Test Infra: NetWhisper

## Test Philosophy
- Opaque-box, requirement-driven testing covering all NetWhisper user requirements (R1–R5).
- Methodology: Category-Partition + Boundary Value Analysis + Pairwise Combinations + Real-World Workload Testing.
- Strict independence: test suites exercise user-facing behaviors, REST APIs, WebSocket streams, and UI flows.

## Feature Inventory
| # | Feature | Source | Tier 1 (Coverage) | Tier 2 (Boundary/Corner) | Tier 3 (Cross-Feature) | Tier 4 (Real-World) |
|---|---------|--------|:-----------------:|:------------------------:|:----------------------:|:-------------------:|
| 1 | Window Controls (Min/Max/Close) | ORIGINAL_REQUEST §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 2 | Mode Switch (Live/Simulation) | ORIGINAL_REQUEST §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 3 | Process Expand/Collapse Controls | ORIGINAL_REQUEST §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 4 | Quick Rescan Button | ORIGINAL_REQUEST §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 5 | Socket Inspector Copy Utilities | ORIGINAL_REQUEST §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 6 | Heatmap Stream Controls (Pause/Clear) | ORIGINAL_REQUEST §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 7 | Waterfall Stream Controls (Pause/Clear/Export) | ORIGINAL_REQUEST §R1 | ≥5 | ≥5 | ✓ | ✓ |
| 8 | Toast Notification HUD | ORIGINAL_REQUEST §R2 | ≥5 | ≥5 | ✓ | ✓ |
| 9 | Optimistic UI Updates | ORIGINAL_REQUEST §R2 | ≥5 | ≥5 | ✓ | ✓ |
| 10 | Safe Kill Modal & Signal Selection | ORIGINAL_REQUEST §R3 | ≥5 | ≥5 | ✓ | ✓ |
| 11 | System PID Safeguards | ORIGINAL_REQUEST §R3 | ≥5 | ≥5 | ✓ | ✓ |
| 12 | Cross-Tab Click-to-Filter Routing | ORIGINAL_REQUEST §R4 | ≥5 | ≥5 | ✓ | ✓ |
| 13 | Panic Switch Freezing Traffic | ORIGINAL_REQUEST §R1, §R2 | ≥5 | ≥5 | ✓ | ✓ |
| 14 | Automated Backend Pytest Suite | ORIGINAL_REQUEST §R5 | ≥5 | ≥5 | ✓ | ✓ |
| 15 | Electron Security Audit | ORIGINAL_REQUEST §R5 | ≥5 | ≥5 | ✓ | ✓ |

## Test Architecture
- **Backend Test Runner**: `.venv/bin/pytest tests/ -v`
- **Electron Security Audit**: `npm run test:electron` (`node tests/test_electron_security.test.cjs`)
- **Frontend Production Build**: `npm run build` (`vite build`)
- **Frontend Component & Integration Suite**: Automated integration & verification tests verifying DOM state, event firing, toast creation, copy fallbacks, modal interactions, and stream buffers.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Full Threat Remediation Workflow: Detect telemetry beacon -> Inspect socket -> Copy endpoint -> Isolate -> Kill with SIGKILL -> Toast confirmation | F5, F8, F9, F10, F11, F12, F13 | High |
| 2 | Forensic Investigation Flow: Domain Breakdown -> Click telemetry domain -> Cross-tab route to ProcessSocketTree -> Inspect process -> Export Waterfall JSON | F7, F8, F12, F14, F15, F16, F18 | High |
| 3 | Emergency Incident Containment: Toggle Panic Switch -> Verify banner feedback -> Verify all non-system traffic blocked -> Rescan sockets -> Confirm system integrity | F4, F8, F19, F20 | Medium |
| 4 | Stream Analysis Session: Open Heatmap & Waterfall -> Pause stream -> Inspect historical spikes -> Clear stream -> Resume stream | F6, F7, F14, F15 | Medium |
| 5 | Safe Administrative Guardrails: Attempt to kill PID 1 & protected system daemon -> Verify modal warning & blocked action -> Kill legitimate worker process with SIGTERM | F10, F11, F12, F13, F20 | High |

## Coverage Thresholds
- Tier 1: ≥5 test cases per feature (75+ tests)
- Tier 2: ≥5 boundary & corner tests per feature (75+ tests)
- Tier 3: Pairwise interaction tests across all major feature pairs (15+ tests)
- Tier 4: ≥5 realistic end-to-end workload scenarios
- Tier 5: Adversarial white-box coverage hardening
