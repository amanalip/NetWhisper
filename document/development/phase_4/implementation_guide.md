# NetWhisper: Phase 4 Implementation Guide

This document records the design, implementation, and component breakdown for Phase 4: Frontend Desktop User Interface and Real-Time Visualizations.

![NetWhisper Real Application Interface](app_ui_actual.png)

---

## 1. Overview of Phase 4 Deliverables

Phase 4 implemented the complete React + Vite desktop interface, featuring glassmorphism design tokens, live telemetry metrics, an interactive process socket tree, a domain resolution matrix, an HTML5 Canvas 2D activity heatmap, and a real-time event waterfall stream.

Every component file has been written with thorough line-by-line comments for educational and technical clarity.

---

## 2. Component Implementation Details

### 2.1 Master Design System (`src/index.css`)
- Defines HSL and RGB CSS custom properties for cybersecurity dark themes (`--bg-primary: #06090e`, `--bg-card: rgba(16, 24, 38, 0.75)`).
- Semantic colors for risk levels (`--risk-low: #10b981`, `--risk-high: #f97316`, `--risk-critical: #ef4444`).
- Custom thin scrollbars, responsive flex/grid layouts, and fluid micro-animations.

### 2.2 TitleBar (`src/components/TitleBar.jsx`)
- Frameless desktop header containing the NetWhisper brand logo, live connection beacon, engine mode toggle button (`LIVE` vs `SIMULATION`), and native window controls (Minimize, Maximize, Close).

### 2.3 Global Controls Toolbar (`src/components/GlobalControls.jsx`)
- Search input filtering by PID, process name, domain, or port.
- Filter pills for process categories (Browsers, Dev Tools, CLI Utilities, Desktop Apps, Background Daemons).
- Filter pills for risk ratings (Critical, High, Medium, Low).
- Global Panic Button to instantly freeze all non-system background outbound traffic.

### 2.4 Process Socket Tree (`src/components/ProcessSocketTree.jsx`)
- Interactive collapsible cards grouping active sockets under parent processes.
- Displays PID, process name, category badge, risk tag, CPU percentage, RAM footprint (MB), and socket count.
- Action buttons per process: **ISOLATE** (blocks network connectivity) and **KILL** (sends SIGTERM/SIGKILL).
- Sub-item socket rows showing protocol (`TCP`/`UDP`), local endpoint, encryption lock status, remote domain/IP, connection state (`ESTABLISHED`, `BLOCKED`), and live byte transfer velocity.

### 2.5 Domain Resolution Matrix (`src/components/DomainBreakdown.jsx`)
- Category distribution metric cards.
- Structured breakdown table displaying contacted remote domains, service classification (Telemetry, Cloud Infrastructure, Unencrypted Web), risk tag, socket count, and owning processes.

### 2.6 Packet Volume Heatmap (`src/components/PacketHeatmap.jsx`)
- High-performance HTML5 Canvas rendering a 2D timeline heatmap (Time vs Frequency) highlighting bursty beaconing behavior.
- Real-time throughput waveform canvas plotting inbound (Rx) and outbound (Tx) transfer velocity smoothly at 60 FPS.

### 2.7 Network Waterfall Event Stream (`src/components/NetworkWaterfall.jsx`)
- Real-time streaming event log capturing new socket detections, kill switches, and isolation interventions.
- Pause/resume toggle and native JSON export functionality.

### 2.8 Process Detail Inspector Drawer (`src/components/ProcessDetailModal.jsx`)
- Deep-dive drawer displaying socket inode, local and remote endpoints, buffer metrics, sanitized process command line, and resource utilization.

### 2.9 App Root Assembly (`src/App.jsx`)
- Manages WebSocket connection to `ws://127.0.0.1:8765/ws/traffic` with automatic reconnection.
- Fetches initial REST snapshot on load for immediate zero-latency rendering.
- State aggregation for summary KPIs, processes, domains, and event history.

---

## 3. Technology and File Summary

| File | Component Name | Description |
| :--- | :--- | :--- |
| `src/index.css` | Design System | Master styling, CSS variables, and layout tokens |
| `src/components/TitleBar.jsx` | TitleBar | Frameless desktop header and window controls |
| `src/components/GlobalControls.jsx` | GlobalControls | Search bar, category filters, and panic button |
| `src/components/ProcessSocketTree.jsx` | ProcessSocketTree | Hierarchical process-to-socket explorer |
| `src/components/DomainBreakdown.jsx` | DomainBreakdown | Domain categorization and telemetry matrix |
| `src/components/PacketHeatmap.jsx` | PacketHeatmap | HTML5 Canvas 2D activity heatmap and waveform |
| `src/components/NetworkWaterfall.jsx` | NetworkWaterfall | Live event stream and JSON export |
| `src/components/ProcessDetailModal.jsx` | ProcessDetailModal | Low-level socket drawer and sanitized metadata |
| `src/App.jsx` | App | Master application layout and WebSocket client |
| `src/main.jsx` | Main | React 18 DOM mounting entrypoint |
