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

/**
 * App Root Component for NetWhisper.
 * Manages WebSocket telemetry subscription, state aggregation, tab navigation, and action handlers.
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

  // Active view tab state.
  const [activeTab, setActiveTab] = useState('processes'); // 'processes', 'domains', 'heatmap', 'waterfall'

  // Filter toolbar state.
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeRisk, setActiveRisk] = useState('all');

  // Selected socket detail drawer state.
  const [selectedItem, setSelectedItem] = useState(null);

  // WebSocket reference.
  const wsRef = useRef(null);

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

  // Toggle engine mode between live and simulation.
  const handleToggleMode = async () => {
    const nextMode = mode === 'live' ? 'simulation' : 'live';
    try {
      const res = await fetch('http://127.0.0.1:8765/api/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: nextMode })
      });
      if (res.ok) {
        setMode(nextMode);
        fetchEvents();
      }
    } catch (err) {
      console.error('[API] Failed to toggle mode:', err);
    }
  };

  // Toggle per-process network isolation.
  const handleIsolateProcess = async (pid, isolate) => {
    try {
      const res = await fetch('http://127.0.0.1:8765/api/sandbox/isolate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid, isolate })
      });
      if (res.ok) {
        fetchEvents();
      }
    } catch (err) {
      console.error('[API] Failed to isolate process:', err);
    }
  };

  // Terminate process via kill switch.
  const handleKillProcess = async (pid) => {
    try {
      const res = await fetch('http://127.0.0.1:8765/api/sandbox/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid, signal: 'SIGTERM' })
      });
      if (res.ok) {
        fetchEvents();
      } else {
        const errData = await res.json();
        alert(`Action Failed: ${errData.detail || 'Could not terminate process'}`);
      }
    } catch (err) {
      console.error('[API] Failed to terminate process:', err);
    }
  };

  // Toggle global panic mode.
  const handleTogglePanic = async () => {
    const nextPanic = !summary.panic_mode;
    try {
      const res = await fetch('http://127.0.0.1:8765/api/panic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextPanic })
      });
      if (res.ok) {
        setSummary((prev) => ({ ...prev, panic_mode: nextPanic }));
        fetchEvents();
      }
    } catch (err) {
      console.error('[API] Failed to toggle panic mode:', err);
    }
  };

  // Export event logs to JSON file.
  const handleExportLogs = async () => {
    const logPayload = {
      exported_at: new Date().toISOString(),
      summary,
      processes,
      domains,
      events
    };

    if (window.electronAPI && window.electronAPI.exportLogs) {
      const result = await window.electronAPI.exportLogs(logPayload);
      if (result.success) {
        alert(`Logs exported successfully to: ${result.filePath}`);
      }
    } else {
      // Browser fallback download
      const blob = new Blob([JSON.stringify(logPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `netwhisper-log-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Filter processes based on search query, category, and risk.
  const filteredProcesses = processes.filter((p) => {
    // Search query filter.
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchPid = String(p.pid).includes(q);
      const matchName = p.name && p.name.toLowerCase().includes(q);
      const matchCmd = p.cmdline && p.cmdline.toLowerCase().includes(q);
      const matchSocket = p.sockets && p.sockets.some((s) => (s.remote_domain && s.remote_domain.toLowerCase().includes(q)) || String(s.remote_port).includes(q));
      if (!matchPid && !matchName && !matchCmd && !matchSocket) return false;
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
        />

        {/* Tab 1: Process Sockets Hierarchy */}
        {activeTab === 'processes' && (
          <ProcessSocketTree
            processes={filteredProcesses}
            onIsolate={handleIsolateProcess}
            onKill={handleKillProcess}
            onSelectSocket={setSelectedItem}
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
        />
      )}
    </div>
  );
}
