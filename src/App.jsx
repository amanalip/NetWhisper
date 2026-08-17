// Import React and standard hooks.
import React, { useState, useEffect, useRef } from 'react';
// Import icons from lucide-react.
import {
  ShieldAlert,
  Layers,
  Globe,
  BarChart3,
  Activity,
  Zap,
  Slash,
  Radio,
  Download
} from 'lucide-react';

// Import subcomponents.
import TitleBar from './components/TitleBar';
import GlobalControls from './components/GlobalControls';
import ProcessSocketTree from './components/ProcessSocketTree';
import DomainBreakdown from './components/DomainBreakdown';
import PacketHeatmap from './components/PacketHeatmap';
import NetworkWaterfall from './components/NetworkWaterfall';
import ProcessDetailModal from './components/ProcessDetailModal';
import ToastHUD from './components/ToastHUD';

/**
 * App Root Component for NetWhisper.
 * Manages WebSocket telemetry subscription, state aggregation, tab navigation, optimistic action handlers, and Toast HUD.
 */
export default function App() {
  // Connection state boolean.
  const [isConnected, setIsConnected] = useState(false);
  // Active engine mode defaults to 'live' Linux monitoring.
  const [mode, setMode] = useState('live');
  // Summary KPI metrics object.
  const [summary, setSummary] = useState({
    total_processes: 0,
    active_sockets: 0,
    bandwidth_in_bps: 0,
    bandwidth_out_bps: 0,
    high_risk_count: 0,
    panic_mode: false,
    isolated_pids_count: 0
  });

  // Telemetry lists reflecting live host system sockets.
  const [processes, setProcesses] = useState([]);
  const [domains, setDomains] = useState([]);
  const [categories, setCategories] = useState({});
  const [events, setEvents] = useState([]);

  // Toast Notification HUD state.
  const [toasts, setToasts] = useState([]);

  // Active view tab state.
  const [activeTab, setActiveTab] = useState('processes'); // 'processes', 'domains', 'heatmap', 'waterfall'

  // Filter toolbar state.
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeRisk, setActiveRisk] = useState('all');

  // Rescan feedback state.
  const [isRescanning, setIsRescanning] = useState(false);

  // Expanded process card PIDs state coordinated across tabs.
  const [expandedPids, setExpandedPids] = useState(new Set([4182, 5891, 7240, 9811]));

  // Selected socket detail drawer state.
  const [selectedItem, setSelectedItem] = useState(null);

  // WebSocket reference.
  const wsRef = useRef(null);

  // Toast dispatch and eviction helper.
  const addToast = ({ type = 'info', title, message, duration = 4000 }) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newToast = {
      id,
      type,
      title: title || (type === 'error' ? 'Error' : 'Notification'),
      message,
      duration,
      createdAt: Date.now()
    };

    setToasts((prev) => {
      const updated = [...prev, newToast];
      if (updated.length > 5) {
        return updated.slice(updated.length - 5);
      }
      return updated;
    });

    return id;
  };

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Fetch initial snapshot on load for immediate UI rendering.
  const fetchInitialSnapshot = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8765/api/snapshot');
      if (res.ok) {
        const data = await res.json();
        if (data.summary) setSummary(data.summary);
        if (data.mode) setMode(data.mode);
        if (data.processes) setProcesses(data.processes);
        if (data.domains) setDomains(data.domains);
        if (data.categories) setCategories(data.categories);
        setIsConnected(true);
      }
    } catch (err) {
      console.log('[API] Waiting for live engine startup...');
    }
  };

  // Establish and supervise WebSocket connection to the local Python daemon.
  useEffect(() => {
    let reconnectTimeout = null;

    // Fetch initial snapshot immediately
    fetchInitialSnapshot();

    const connectWebSocket = () => {
      // Connect to loopback 127.0.0.1 port 8765.
      const wsUrl = 'ws://127.0.0.1:8765/ws/traffic';
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected to NetWhisper telemetry engine');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.summary) setSummary(data.summary);
          if (data.mode) setMode(data.mode);
          if (data.processes) setProcesses(data.processes);
          if (data.domains) setDomains(data.domains);
          if (data.categories) setCategories(data.categories);
        } catch (err) {
          console.error('[WS] Error parsing telemetry packet:', err);
        }
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected from engine. Retrying in 2 seconds...');
        setIsConnected(false);
        reconnectTimeout = setTimeout(connectWebSocket, 2000);
      };

      ws.onerror = (err) => {
        console.error('[WS] Error:', err);
        ws.close();
      };
    };

    connectWebSocket();

    // Fetch initial event history.
    fetchEvents();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Fetch recent event history from REST API.
  const fetchEvents = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8765/api/events');
      if (res.ok) {
        const data = await res.json();
        if (data.events && data.events.length > 0) {
          setEvents(data.events);
        }
      }
    } catch (err) {
      console.log('[API] Daemon event history fetch error.');
    }
  };

  // Toggle engine mode between live and simulation with optimistic UI update and error recovery.
  const handleToggleMode = async (targetMode) => {
    const nextMode = targetMode || (mode === 'live' ? 'simulation' : 'live');
    if (nextMode === mode) return; // No-op if already in target mode

    const previousMode = mode;
    // 1. Optimistic update for instant tactile feedback
    setMode(nextMode);

    addToast({
      type: 'info',
      title: nextMode === 'live' ? 'Live Linux Mode Active' : 'Simulation Mode Active',
      message: nextMode === 'live'
        ? 'Streaming real-time procfs socket telemetry from host'
        : 'Running synthetic privacy threat scenarios'
    });

    try {
      const res = await fetch('http://127.0.0.1:8765/api/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: nextMode })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.mode) {
          setMode(data.mode);
        }
        fetchEvents();
      } else {
        console.error('[API] Server returned error for mode toggle:', res.statusText);
        // Revert optimistic update on server error
        setMode(previousMode);
        addToast({
          type: 'error',
          title: 'Mode Switch Failed',
          message: `Failed to transition engine to ${nextMode} mode`
        });
      }
    } catch (err) {
      console.warn('[API] Mode toggle network error (offline dev mode active):', err.message);
      // In disconnected / preview mode, maintain optimistic mode for UI testing
    }
  };

  // Immediate manual snapshot and event log rescan with tactile duration.
  const handleRescan = async () => {
    if (isRescanning) return;
    setIsRescanning(true);
    const startTime = Date.now();
    try {
      await Promise.all([
        fetchInitialSnapshot(),
        fetchEvents()
      ]);
      addToast({
        type: 'info',
        title: 'Host Sockets Rescanned',
        message: 'Telemetry snapshot refreshed with active host processes',
        duration: 2500
      });
    } catch (err) {
      console.error('[API] Failed manual snapshot rescan:', err);
      addToast({
        type: 'error',
        title: 'Rescan Failed',
        message: 'Unable to refresh host procfs socket telemetry'
      });
    } finally {
      const elapsed = Date.now() - startTime;
      const remainingDelay = Math.max(0, 500 - elapsed);
      setTimeout(() => {
        setIsRescanning(false);
      }, remainingDelay);
    }
  };

  // Reset all search and filter criteria.
  const handleResetFilters = () => {
    setSearchQuery('');
    setActiveCategory('all');
    setActiveRisk('all');
  };

  // Toggle single process card expansion.
  const handleToggleExpand = (pid) => {
    setExpandedPids((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) {
        next.delete(pid);
      } else {
        next.add(pid);
      }
      return next;
    });
  };

  // Expand all provided PIDs.
  const handleExpandAll = (pidsToExpand) => {
    setExpandedPids((prev) => {
      const next = new Set(prev);
      pidsToExpand.forEach((pid) => next.add(pid));
      return next;
    });
  };

  // Collapse all process cards.
  const handleCollapseAll = () => {
    setExpandedPids(new Set());
  };

  // Toggle per-process network isolation with optimistic UI updates and error rollback.
  const handleIsolateProcess = async (pid, isolate, customName) => {
    const target = processes.find((p) => p.pid === pid);
    const nextIsolate = typeof isolate === 'boolean' ? isolate : !target?.is_isolated;
    const procName = customName || target?.name || `PID ${pid}`;

    const prevProcesses = processes;
    const prevSummary = summary;

    // Optimistic local state update
    setProcesses((prev) =>
      prev.map((p) => {
        if (p.pid !== pid) return p;
        return {
          ...p,
          is_isolated: nextIsolate,
          sockets: (p.sockets || []).map((s) => ({
            ...s,
            state: nextIsolate ? 'BLOCKED' : (s.state === 'BLOCKED' ? 'ESTABLISHED' : s.state),
            bandwidth_out_bps: nextIsolate ? 0 : s.bandwidth_out_bps,
            bandwidth_in_bps: nextIsolate ? 0 : s.bandwidth_in_bps
          }))
        };
      })
    );

    setSummary((prev) => ({
      ...prev,
      isolated_pids_count: nextIsolate
        ? prev.isolated_pids_count + 1
        : Math.max(0, prev.isolated_pids_count - 1)
    }));

    setSelectedItem((prev) => {
      if (!prev || prev.process?.pid !== pid) return prev;
      return {
        ...prev,
        process: { ...prev.process, is_isolated: nextIsolate }
      };
    });

    addToast({
      type: nextIsolate ? 'warning' : 'info',
      title: nextIsolate ? 'Process Isolated' : 'Isolation Lifted',
      message: nextIsolate
        ? `Blocked outbound socket traffic for ${procName} (PID ${pid})`
        : `Restored network socket connectivity for ${procName} (PID ${pid})`
    });

    try {
      const res = await fetch('http://127.0.0.1:8765/api/sandbox/isolate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid, isolate: nextIsolate })
      });

      if (res.ok) {
        fetchEvents();
      } else {
        const errData = await res.json().catch(() => ({}));
        setProcesses(prevProcesses);
        setSummary(prevSummary);
        setSelectedItem((prev) => {
          if (!prev || prev.process?.pid !== pid) return prev;
          return {
            ...prev,
            process: { ...prev.process, is_isolated: !nextIsolate }
          };
        });
        addToast({
          type: 'error',
          title: 'Isolation Failed',
          message: errData.detail || `Could not update sandbox isolation for ${procName}`
        });
      }
    } catch (err) {
      console.warn('[API] Isolate process network error (offline preview active):', err.message);
    }
  };

  // Terminate process via kill switch with optimistic state removal and error rollback.
  const handleKillProcess = async (pid, customName) => {
    const target = processes.find((p) => p.pid === pid);
    const procName = customName || target?.name || `PID ${pid}`;
    const socketCount = target?.sockets?.length || 0;
    const isIsolated = target?.is_isolated || false;

    const prevProcesses = processes;
    const prevSummary = summary;

    // Optimistic local state removal
    setProcesses((prev) => prev.filter((p) => p.pid !== pid));
    setSummary((prev) => ({
      ...prev,
      total_processes: Math.max(0, prev.total_processes - 1),
      active_sockets: Math.max(0, prev.active_sockets - socketCount),
      isolated_pids_count: isIsolated ? Math.max(0, prev.isolated_pids_count - 1) : prev.isolated_pids_count
    }));

    setSelectedItem((prev) => (prev?.process?.pid === pid ? null : prev));

    addToast({
      type: 'success',
      title: 'Process Terminated',
      message: `Dispatched SIGTERM to ${procName} (PID ${pid})`
    });

    try {
      const res = await fetch('http://127.0.0.1:8765/api/sandbox/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid, signal: 'SIGTERM' })
      });

      if (res.ok) {
        fetchEvents();
      } else {
        const errData = await res.json().catch(() => ({}));
        setProcesses(prevProcesses);
        setSummary(prevSummary);
        addToast({
          type: 'error',
          title: 'Termination Failed',
          message: errData.detail || `Server could not terminate ${procName} (PID ${pid})`
        });
      }
    } catch (err) {
      console.warn('[API] Kill process network error (offline preview active):', err.message);
    }
  };

  // Toggle global panic mode with optimistic UI updates and error recovery.
  const handleTogglePanic = async () => {
    const nextPanic = !summary.panic_mode;
    const previousPanic = summary.panic_mode;

    setSummary((prev) => ({ ...prev, panic_mode: nextPanic }));

    addToast({
      type: nextPanic ? 'error' : 'info',
      title: nextPanic ? 'Panic Mode Activated' : 'Panic Mode Deactivated',
      message: nextPanic
        ? 'Emergency lockdown: All outbound non-system network sockets frozen'
        : 'Emergency lockdown lifted: Normal network traffic resumed'
    });

    try {
      const res = await fetch('http://127.0.0.1:8765/api/panic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextPanic })
      });

      if (res.ok) {
        fetchEvents();
      } else {
        const errData = await res.json().catch(() => ({}));
        setSummary((prev) => ({ ...prev, panic_mode: previousPanic }));
        addToast({
          type: 'error',
          title: 'Panic Switch Error',
          message: errData.detail || 'Failed to synchronize panic state with engine'
        });
      }
    } catch (err) {
      console.warn('[API] Panic toggle network error (offline preview active):', err.message);
    }
  };

  // Export event logs to JSON file with toast notification feedback.
  const handleExportLogs = async () => {
    const logPayload = {
      exported_at: new Date().toISOString(),
      summary,
      processes,
      domains,
      events
    };

    if (window.electronAPI && window.electronAPI.exportLogs) {
      try {
        const result = await window.electronAPI.exportLogs(logPayload);
        if (result.success) {
          addToast({
            type: 'success',
            title: 'Telemetry Logs Exported',
            message: `Saved ${events.length} records to ${result.filePath}`
          });
        } else if (!result.canceled) {
          addToast({
            type: 'error',
            title: 'Export Failed',
            message: result.error || 'Failed to save telemetry log file'
          });
        }
      } catch (err) {
        addToast({
          type: 'error',
          title: 'Export Failed',
          message: err.message || 'Error occurred during log export'
        });
      }
    } else {
      // Browser fallback download
      try {
        const filename = `netwhisper-log-${Date.now()}.json`;
        const blob = new Blob([JSON.stringify(logPayload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        addToast({
          type: 'success',
          title: 'Telemetry Logs Exported',
          message: `Downloaded snapshot as ${filename}`
        });
      } catch (err) {
        addToast({
          type: 'error',
          title: 'Export Failed',
          message: 'Could not trigger browser JSON log download'
        });
      }
    }
  };

  // Filter processes based on search query, category, and risk.
  const filteredProcesses = processes.filter((p) => {
    // Search query filter matching multiple attributes.
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      const matchPid = String(p.pid).includes(q);
      const matchName = p.name && p.name.toLowerCase().includes(q);
      const matchCmd = p.cmdline && p.cmdline.toLowerCase().includes(q);
      const matchCategory = p.category && p.category.toLowerCase().includes(q);
      const matchSocket = p.sockets && p.sockets.some((s) =>
        (s.remote_domain && s.remote_domain.toLowerCase().includes(q)) ||
        (s.remote_ip && s.remote_ip.toLowerCase().includes(q)) ||
        (s.local_ip && s.local_ip.toLowerCase().includes(q)) ||
        String(s.remote_port).includes(q) ||
        String(s.local_port).includes(q) ||
        (s.proto && s.proto.toLowerCase().includes(q)) ||
        (s.state && s.state.toLowerCase().includes(q)) ||
        (s.category && s.category.toLowerCase().includes(q))
      );
      if (!matchPid && !matchName && !matchCmd && !matchCategory && !matchSocket) return false;
    }

    // Category filter.
    if (activeCategory !== 'all' && p.category !== activeCategory) {
      return false;
    }

    // Risk filter.
    if (activeRisk !== 'all' && p.risk_level !== activeRisk) {
      return false;
    }

    return true;
  });

  return (
    <div className="app-container">
      {/* Custom Titlebar */}
      <TitleBar isConnected={isConnected} mode={mode} onToggleMode={handleToggleMode} />

      {/* Main Navigation Bar */}
      <nav className="main-nav">
        <div className="nav-tabs">
          <button
            className={`nav-tab ${activeTab === 'processes' ? 'active' : ''}`}
            onClick={() => setActiveTab('processes')}
          >
            <Layers size={15} />
            <span>Process Sockets</span>
            <span className="nav-tab-badge">{processes.length}</span>
          </button>

          <button
            className={`nav-tab ${activeTab === 'domains' ? 'active' : ''}`}
            onClick={() => setActiveTab('domains')}
          >
            <Globe size={15} />
            <span>Domain Breakdown</span>
            <span className="nav-tab-badge">{domains.length}</span>
          </button>

          <button
            className={`nav-tab ${activeTab === 'heatmap' ? 'active' : ''}`}
            onClick={() => setActiveTab('heatmap')}
          >
            <BarChart3 size={15} />
            <span>Packet Heatmap</span>
          </button>

          <button
            className={`nav-tab ${activeTab === 'waterfall' ? 'active' : ''}`}
            onClick={() => setActiveTab('waterfall')}
          >
            <Activity size={15} />
            <span>Event Waterfall</span>
            <span className="nav-tab-badge">{events.length}</span>
          </button>
        </div>

        {/* Status Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {summary.high_risk_count > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--risk-high)', fontSize: '12px', fontWeight: '600' }}>
              <ShieldAlert size={14} />
              <span>{summary.high_risk_count} Telemetry Alerts</span>
            </div>
          )}
        </div>
      </nav>

      {/* Quick Metrics Bar */}
      <div className="kpi-bar">
        <div className="kpi-card">
          <div className="kpi-icon"><Layers size={18} /></div>
          <div className="kpi-info">
            <span className="kpi-label">Active Processes</span>
            <span className="kpi-value">{summary.total_processes}</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon"><Radio size={18} /></div>
          <div className="kpi-info">
            <span className="kpi-label">Active Sockets</span>
            <span className="kpi-value">{summary.active_sockets}</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon"><Activity size={18} /></div>
          <div className="kpi-info">
            <span className="kpi-label">Inbound (Rx)</span>
            <span className="kpi-value">{Math.round(summary.bandwidth_in_bps / 8)} B/s</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon"><Activity size={18} /></div>
          <div className="kpi-info">
            <span className="kpi-label">Outbound (Tx)</span>
            <span className="kpi-value">{Math.round(summary.bandwidth_out_bps / 8)} B/s</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon"><Slash size={18} color="var(--accent-red)" /></div>
          <div className="kpi-info">
            <span className="kpi-label">Isolated PIDs</span>
            <span className="kpi-value" style={{ color: summary.isolated_pids_count > 0 ? 'var(--accent-red)' : 'var(--text-primary)' }}>
              {summary.isolated_pids_count}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Viewport */}
      <main className="content-viewport">
        {/* Global Toolbar */}
        <GlobalControls
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          activeRisk={activeRisk}
          onRiskChange={setActiveRisk}
          panicMode={summary.panic_mode}
          onTogglePanic={handleTogglePanic}
          isRescanning={isRescanning}
          onRescan={handleRescan}
          onResetFilters={handleResetFilters}
        />

        {/* Tab 1: Process Sockets Hierarchy */}
        {activeTab === 'processes' && (
          <ProcessSocketTree
            processes={filteredProcesses}
            onIsolate={handleIsolateProcess}
            onKill={handleKillProcess}
            onSelectSocket={setSelectedItem}
            expandedPids={expandedPids}
            onToggleExpand={handleToggleExpand}
            onExpandAll={handleExpandAll}
            onCollapseAll={handleCollapseAll}
          />
        )}

        {/* Tab 2: Domain Resolution Breakdown */}
        {activeTab === 'domains' && (
          <DomainBreakdown domains={domains} categories={categories} />
        )}

        {/* Tab 3: Packet Volume Heatmaps */}
        {activeTab === 'heatmap' && (
          <PacketHeatmap
            history={{ timestamp: Date.now() }}
            bandwidthIn={summary.bandwidth_in_bps}
            bandwidthOut={summary.bandwidth_out_bps}
          />
        )}

        {/* Tab 4: Live Event Waterfall */}
        {activeTab === 'waterfall' && (
          <NetworkWaterfall events={events} onExportLogs={handleExportLogs} />
        )}
      </main>

      {/* Socket Deep-Dive Drawer Modal */}
      {selectedItem && (
        <ProcessDetailModal
          selectedItem={selectedItem}
          onClose={() => setSelectedItem(null)}
          onKillProcess={handleKillProcess}
          onIsolateProcess={handleIsolateProcess}
          onToast={addToast}
        />
      )}

      {/* Non-blocking Floating Toast Notification HUD */}
      <ToastHUD toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
