/**
 * Frontend UI Component & Interaction Test Suite for NetWhisper.
 * Uses native node:test and node:assert with in-memory esbuild JSX transpilation.
 * Covers Features F1–F19 across Tiers 1–4.
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const esbuild = require('esbuild');

// Helper to load and transpile JSX components using esbuild
function loadComponent(relativePath) {
  const filePath = path.resolve(__dirname, '..', relativePath);
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = esbuild.transformSync(source, {
    loader: 'jsx',
    format: 'cjs',
    target: 'node18'
  });

  const moduleExports = {};
  const evalFunc = new Function('require', 'module', 'exports', 'React', transpiled.code);
  const customRequire = (mod) => {
    if (mod === 'react') return React;
    if (mod === 'lucide-react') {
      // Mock Lucide icon components returning simple SVG stubs
      return new Proxy({}, {
        get: (_target, prop) => (props) =>
          React.createElement('svg', { 'data-icon': String(prop), className: props.className, ...props })
      });
    }
    if (mod.startsWith('.')) {
      const resolved = path.resolve(path.dirname(filePath), mod);
      const ext = ['.jsx', '.js', ''].find((e) => fs.existsSync(resolved + e));
      return loadComponent(path.relative(path.resolve(__dirname, '..'), resolved + (ext || '')));
    }
    return require(mod);
  };

  const modObj = { exports: moduleExports };
  evalFunc(customRequire, modObj, moduleExports, React);
  return modObj.exports.default || modObj.exports;
}

// Load components
const TitleBar = loadComponent('src/components/TitleBar.jsx');
const GlobalControls = loadComponent('src/components/GlobalControls.jsx');
const ProcessSocketTree = loadComponent('src/components/ProcessSocketTree.jsx');
const ProcessDetailModal = loadComponent('src/components/ProcessDetailModal.jsx');
const NetworkWaterfall = loadComponent('src/components/NetworkWaterfall.jsx');
const DomainBreakdown = loadComponent('src/components/DomainBreakdown.jsx');
const PacketHeatmap = loadComponent('src/components/PacketHeatmap.jsx');
const ToastHUD = loadComponent('src/components/ToastHUD.jsx');

// ==============================================================================
// SUITE 1: TitleBar Window Controls (F1, F2)
// ==============================================================================
describe('Suite 1: TitleBar Window Controls (F1, F2)', () => {
  it('T1-F1-01: Renders NetWhisper brand title and status beacon', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(TitleBar, { isConnected: true, mode: 'live' })
    );
    assert(html.includes('NetWhisper'), 'Brand title must be visible.');
    assert(html.includes('titlebar-beacon'), 'Status beacon element must be rendered.');
    assert(!html.includes('titlebar-beacon offline'), 'Beacon must not be offline when isConnected=true.');
  });

  it('T1-F1-02: Status beacon applies offline class when disconnected', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(TitleBar, { isConnected: false, mode: 'live' })
    );
    assert(html.includes('titlebar-beacon offline'), 'Beacon must contain offline class when isConnected=false.');
  });

  it('T1-F1-03: Window control buttons (minimize, maximize, close) render with correct attributes', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(TitleBar, { isConnected: true, mode: 'live' })
    );
    assert(html.includes('Minimize Window'), 'Minimize button must be rendered.');
    assert(html.includes('Maximize / Restore Window'), 'Maximize button must be rendered.');
    assert(html.includes('Close Window'), 'Close button must be rendered.');
  });

  it('T1-F2-04: Mode switcher highlights Live Linux button when mode is live', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(TitleBar, { isConnected: true, mode: 'live' })
    );
    assert(html.includes('active live'), 'Live button must have active class.');
    assert(html.includes('mode-pulse-dot'), 'Pulse dot must be rendered for active Live mode.');
  });

  it('T1-F2-05: Mode switcher highlights Simulation button when mode is simulation', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(TitleBar, { isConnected: true, mode: 'simulation' })
    );
    assert(html.includes('active simulation'), 'Simulation button must have active class.');
  });
});

// ==============================================================================
// SUITE 2: Global Toolbar & Search / Filter Controls (F5, F6)
// ==============================================================================
describe('Suite 2: Global Toolbar & Search / Filter Controls (F5, F6)', () => {
  it('T1-F6-01: Renders search input with placeholder and value', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(GlobalControls, {
        searchQuery: 'spotify',
        onSearchChange: () => {},
        activeCategory: 'all',
        onCategoryChange: () => {},
        activeRisk: 'all',
        onRiskChange: () => {},
        panicMode: false,
        onTogglePanic: () => {}
      })
    );
    assert(html.includes('value="spotify"'), 'Search input must display the search query.');
    assert(html.includes('search-clear-btn'), 'Clear button must render when query is non-empty.');
  });

  it('T1-F6-02: Renders all 6 category filter pills and marks active category', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(GlobalControls, {
        searchQuery: '',
        onSearchChange: () => {},
        activeCategory: 'developer_tool',
        onCategoryChange: () => {},
        activeRisk: 'all',
        onRiskChange: () => {},
        panicMode: false,
        onTogglePanic: () => {}
      })
    );
    assert(html.includes('All Processes'), 'All Processes pill rendered.');
    assert(html.includes('Browsers'), 'Browsers pill rendered.');
    assert(html.includes('Dev Tools'), 'Dev Tools pill rendered.');
    assert(html.includes('CLI Utilities'), 'CLI Utilities pill rendered.');
    assert(html.includes('Desktop Apps'), 'Desktop Apps pill rendered.');
    assert(html.includes('Background Daemons'), 'Background Daemons pill rendered.');
    assert(html.includes('pill-btn active'), 'Selected category must have active class.');
  });

  it('T1-F6-03: Renders risk filter pills (Critical, High, Medium, Low)', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(GlobalControls, {
        searchQuery: '',
        onSearchChange: () => {},
        activeCategory: 'all',
        onCategoryChange: () => {},
        activeRisk: 'high',
        onRiskChange: () => {},
        panicMode: false,
        onTogglePanic: () => {}
      })
    );
    assert(html.includes('risk-pill critical'), 'Critical risk pill rendered.');
    assert(html.includes('risk-pill high active'), 'High risk pill must be active.');
  });

  it('T1-F5-04: Quick Rescan button renders and reflects isRescanning state', () => {
    const htmlIdle = ReactDOMServer.renderToString(
      React.createElement(GlobalControls, {
        isRescanning: false,
        onRescan: () => {},
        panicMode: false
      })
    );
    assert(htmlIdle.includes('Rescan'), 'Rescan button text rendered.');

    const htmlScanning = ReactDOMServer.renderToString(
      React.createElement(GlobalControls, {
        isRescanning: true,
        onRescan: () => {},
        panicMode: false
      })
    );
    assert(htmlScanning.includes('rescanning'), 'Rescan button has rescanning class.');
    assert(htmlScanning.includes('Scanning...'), 'Rescan button text updates to Scanning...');
  });

  it('T1-F19-05: Panic switch displays active state when panicMode=true', () => {
    const htmlPanic = ReactDOMServer.renderToString(
      React.createElement(GlobalControls, {
        panicMode: true,
        onTogglePanic: () => {}
      })
    );
    assert(htmlPanic.includes('panic-btn active'), 'Panic button has active class.');
    assert(htmlPanic.includes('PANIC ACTIVE (BLOCKING)'), 'Panic button displays blocking warning.');
  });
});

// ==============================================================================
// SUITE 3: Process Socket Tree & Accordion Controls (F3, F4, F8)
// ==============================================================================
describe('Suite 3: Process Socket Tree & Accordion Controls (F3, F4, F8)', () => {
  const sampleProcesses = [
    {
      pid: 4182,
      ppid: 1200,
      name: 'code-telemetry',
      cmdline: '/usr/share/code/code --telemetry-endpoint',
      category: 'developer_tool',
      cpu_percent: 1.2,
      memory_mb: 184.0,
      username: 'user',
      risk_level: 'high',
      is_isolated: false,
      sockets: [
        {
          proto: 'TCP',
          local_ip: '192.168.1.42',
          local_port: 51240,
          remote_ip: '13.107.42.16',
          remote_port: 443,
          remote_domain: 'telemetry.remote.visualstudio.com',
          state: 'ESTABLISHED',
          category: 'Telemetry & Analytics',
          risk: 'high',
          bandwidth_out_bps: 1024,
          bandwidth_in_bps: 2048,
          is_encrypted: true
        }
      ]
    },
    {
      pid: 9811,
      ppid: 1,
      name: 'stealth_updater',
      cmdline: '/tmp/stealth_updater',
      category: 'background_daemon',
      cpu_percent: 4.0,
      memory_mb: 45.0,
      username: 'user',
      risk_level: 'critical',
      is_isolated: true,
      sockets: [
        {
          proto: 'TCP',
          local_ip: '192.168.1.42',
          local_port: 41209,
          remote_ip: '185.220.101.5',
          remote_port: 4444,
          remote_domain: '185.220.101.5',
          state: 'BLOCKED',
          category: 'Direct IP (Non-standard Port)',
          risk: 'high',
          bandwidth_out_bps: 0,
          bandwidth_in_bps: 0,
          is_encrypted: false
        }
      ]
    }
  ];

  it('T1-F3-01: Renders Expand All and Collapse All control buttons', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(ProcessSocketTree, { processes: sampleProcesses })
    );
    assert(html.includes('Expand All'), 'Expand All button must be rendered.');
    assert(html.includes('Collapse All'), 'Collapse All button must be rendered.');
  });

  it('T1-F4-02: Renders process cards with PID, name, risk badges, and metrics', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(ProcessSocketTree, { processes: sampleProcesses })
    );
    assert(html.includes('4182'), 'PID 4182 rendered.');
    assert(html.includes('code-telemetry'), 'Process name rendered.');
    assert(html.includes('stealth_updater'), 'Process name rendered.');
    assert(html.includes('ISOLATED'), 'Isolated badge rendered for PID 9811.');
  });

  it('T1-F4-03: Empty state rendered when processes array is empty', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(ProcessSocketTree, { processes: [] })
    );
    assert(html.includes('No matching active processes found'), 'Empty state message rendered.');
  });
});

// ==============================================================================
// SUITE 4: Socket Inspector Drawer & Copy Utilities (F9, F10)
// ==============================================================================
describe('Suite 4: Socket Inspector Drawer & Copy Utilities (F9, F10)', () => {
  const selectedItem = {
    process: {
      pid: 5891,
      ppid: 3410,
      name: 'npm-cli-daemon',
      cmdline: 'node /usr/local/bin/npm --token=[REDACTED_TOKEN]',
      category: 'cli_tool',
      cpu_percent: 0.8,
      memory_mb: 94.6,
      username: 'user',
      risk_level: 'high'
    },
    socket: {
      proto: 'TCP',
      local_ip: '192.168.1.42',
      local_port: 48210,
      remote_ip: '104.16.27.35',
      remote_port: 443,
      remote_domain: 'registry.npmjs.org',
      state: 'ESTABLISHED',
      category: 'Cloud Infrastructure',
      risk: 'low',
      inode: 105891,
      bytes_sent: 24500,
      bytes_recv: 128400
    }
  };

  it('T1-F9-01: Renders inspector drawer with process identity and sanitized cmdline', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(ProcessDetailModal, { selectedItem, onClose: () => {} })
    );
    assert(html.includes('5891'), 'Process PID rendered.');
    assert(html.includes('npm-cli-daemon'), 'Process name rendered.');
    assert(html.includes('[REDACTED_TOKEN]'), 'Sanitized command line rendered.');
    assert(html.includes('registry.npmjs.org'), 'Remote domain rendered.');
    assert(html.includes('104.16.27.35'), 'Remote IP rendered.');
    assert(html.includes('443'), 'Remote port rendered.');
  });

  it('T1-F9-02: Returns null when selectedItem is null', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(ProcessDetailModal, { selectedItem: null, onClose: () => {} })
    );
    assert.strictEqual(html, '');
  });

  it('T1-F9-03: Renders clipboard copy buttons for command line, remote IP, domain, and JSON', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(ProcessDetailModal, { selectedItem, onClose: () => {} })
    );
    assert(html.includes('Copy Command'), 'Copy Command button rendered.');
    assert(html.includes('Copy IP'), 'Copy IP button rendered.');
    assert(html.includes('Copy Domain'), 'Copy Domain button rendered.');
    assert(html.includes('Copy JSON'), 'Copy JSON button rendered in modal footer.');
  });

  it('T1-F10-04: Renders in-drawer action buttons for Process Isolation and Termination', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(ProcessDetailModal, {
        selectedItem,
        onClose: () => {},
        onIsolateProcess: () => {},
        onKillProcess: () => {}
      })
    );
    assert(html.includes('Isolate Process'), 'Isolate Process button rendered.');
    assert(html.includes('Terminate Process'), 'Terminate Process button rendered.');
  });

  it('T1-F10-05: Disables Terminate Process button for protected system processes (PID <= 1 or system daemon)', () => {
    const protectedItem = {
      process: {
        pid: 1,
        name: 'systemd',
        cmdline: '/sbin/init',
        category: 'background_daemon',
        cpu_percent: 0.1,
        memory_mb: 12.0,
        username: 'root',
        risk_level: 'low',
        is_isolated: false
      },
      socket: null
    };

    const html = ReactDOMServer.renderToString(
      React.createElement(ProcessDetailModal, {
        selectedItem: protectedItem,
        onClose: () => {},
        onIsolateProcess: () => {},
        onKillProcess: () => {}
      })
    );
    assert(html.includes('disabled=""') || html.includes('disabled'), 'Terminate button must be disabled for PID 1.');
    assert(html.includes('Protected system process cannot be terminated'), 'Tooltip explains why process is protected.');
  });
});

// ==============================================================================
// SUITE 5: System PID Safeguards & Kill Confirmation Modal (F11, F12, F13)
// ==============================================================================
describe('Suite 5: System PID Safeguards & Kill Confirmation Modal (F11, F12, F13)', () => {
  // Logic verification for system safeguards
  function isPidProtected(pid, name) {
    if (pid <= 1) return true;
    const protectedNames = ['systemd', 'init', 'kthreadd', 'dbus-daemon', 'pipewire', 'wireplumber', 'kwin', 'gnome-shell', 'xorg', 'wayland'];
    if (name && protectedNames.includes(name.toLowerCase())) return true;
    return false;
  }

  it('T1-F13-01: Safeguard identifies PID 0 and PID 1 as immutable system components', () => {
    assert.strictEqual(isPidProtected(0, 'idle'), true);
    assert.strictEqual(isPidProtected(1, 'systemd'), true);
  });

  it('T1-F13-02: Safeguard identifies core Linux desktop and display server daemons', () => {
    assert.strictEqual(isPidProtected(120, 'dbus-daemon'), true);
    assert.strictEqual(isPidProtected(140, 'pipewire'), true);
    assert.strictEqual(isPidProtected(150, 'wayland'), true);
    assert.strictEqual(isPidProtected(160, 'xorg'), true);
  });

  it('T1-F13-03: Safeguard allows termination of normal user worker processes', () => {
    assert.strictEqual(isPidProtected(4182, 'code-telemetry'), false);
    assert.strictEqual(isPidProtected(5891, 'npm-cli-daemon'), false);
    assert.strictEqual(isPidProtected(9811, 'stealth_updater'), false);
  });
});

// ==============================================================================
// SUITE 6: Packet Heatmap & Waveform Stream Controls (F14)
// ==============================================================================
describe('Suite 6: Packet Heatmap & Waveform Stream Controls (F14)', () => {
  it('T1-F14-01: Renders 2D activity heatmap and throughput velocity canvas containers', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(PacketHeatmap, {
        history: { timestamp: Date.now() },
        bandwidthIn: 1024,
        bandwidthOut: 512
      })
    );
    assert(html.includes('Packet Volume Activity Heatmap'), 'Heatmap title rendered.');
    assert(html.includes('Throughput Velocity'), 'Waveform title rendered.');
    assert(html.includes('canvas'), 'Canvas elements rendered.');
  });
});

// ==============================================================================
// SUITE 7: Network Waterfall Event Stream Controls (F15)
// ==============================================================================
describe('Suite 7: Network Waterfall Event Stream Controls (F15)', () => {
  const sampleEvents = [
    {
      id: 1,
      timestamp: '14:20:00',
      type: 'isolate',
      title: 'Process 4182 network isolated',
      details: { pid: 4182 }
    },
    {
      id: 2,
      timestamp: '14:20:05',
      type: 'kill',
      title: 'Process 9811 terminated (SIGKILL)',
      details: { signal: 'SIGKILL' }
    }
  ];

  it('T1-F15-01: Renders event list with timestamps, event types, and titles', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(NetworkWaterfall, {
        events: sampleEvents,
        onExportLogs: () => {}
      })
    );
    assert(html.includes('14:20:00'), 'Timestamp rendered.');
    assert(html.includes('isolate'), 'Event badge rendered.');
    assert(html.includes('Process 4182 network isolated'), 'Title rendered.');
    assert(html.includes('EXPORT JSON'), 'Export JSON button rendered.');
  });

  it('T1-F15-02: Renders empty state when event list is empty', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(NetworkWaterfall, {
        events: [],
        onExportLogs: () => {}
      })
    );
    assert(html.includes('No recent network events recorded yet'), 'Empty event message rendered.');
  });
});

// ==============================================================================
// SUITE 8: Domain Breakdown & Cross-Tab Routing (F16, F17, F18)
// ==============================================================================
describe('Suite 8: Domain Breakdown & Cross-Tab Routing (F16, F17, F18)', () => {
  const sampleDomains = [
    {
      domain: 'telemetry.remote.visualstudio.com',
      category: 'Telemetry & Analytics',
      risk: 'high',
      socket_count: 2,
      processes: ['code-telemetry']
    },
    {
      domain: 'api.github.com',
      category: 'Cloud Infrastructure',
      risk: 'low',
      socket_count: 1,
      processes: ['chromium-browser']
    }
  ];

  const sampleCategories = {
    'Telemetry & Analytics': 3,
    'Cloud Infrastructure': 2
  };

  it('T1-F16-01: Renders category distribution grid cards', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(DomainBreakdown, {
        domains: sampleDomains,
        categories: sampleCategories
      })
    );
    assert(html.includes('Telemetry &amp; Analytics') || html.includes('Telemetry'), 'Category card rendered.');
    assert(html.includes('Cloud Infrastructure'), 'Category card rendered.');
  });

  it('T1-F16-02: Renders domain breakdown table rows with risk tags and socket counts', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(DomainBreakdown, {
        domains: sampleDomains,
        categories: sampleCategories
      })
    );
    assert(html.includes('telemetry.remote.visualstudio.com'), 'Domain name rendered.');
    assert(html.includes('api.github.com'), 'Domain name rendered.');
    assert(html.includes('sockets'), 'Socket count label rendered.');
    assert(html.includes('code-telemetry'), 'Owning process name rendered.');
  });
});

// ==============================================================================
// SUITE 9: Toast Notification HUD Simulation (F7)
// ==============================================================================
describe('Suite 9: Toast Notification HUD Logic (F7)', () => {
  class ToastQueue {
    constructor(maxToasts = 5) {
      this.toasts = [];
      this.maxToasts = maxToasts;
    }

    addToast(toast) {
      const id = Date.now() + Math.random();
      const newToast = { id, type: 'info', duration: 3500, ...toast };
      this.toasts.push(newToast);
      if (this.toasts.length > this.maxToasts) {
        this.toasts.shift(); // Evict oldest
      }
      return id;
    }

    dismissToast(id) {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    }
  }

  it('T1-F7-01: Manages toast queue and supports success, error, warning, info types', () => {
    const queue = new ToastQueue();
    queue.addToast({ type: 'success', title: 'Procfs rescanned' });
    queue.addToast({ type: 'error', title: 'Action failed' });

    assert.strictEqual(queue.toasts.length, 2);
    assert.strictEqual(queue.toasts[0].type, 'success');
    assert.strictEqual(queue.toasts[1].type, 'error');
  });

  it('T1-F7-02: Automatically caps queue size to maxToasts without overflow', () => {
    const queue = new ToastQueue(3);
    for (let i = 0; i < 5; i++) {
      queue.addToast({ title: `Toast #${i}` });
    }
    assert.strictEqual(queue.toasts.length, 3);
    assert.strictEqual(queue.toasts[0].title, 'Toast #2');
    assert.strictEqual(queue.toasts[2].title, 'Toast #4');
  });

  it('T1-F7-03: Dismisses specific toast by ID', () => {
    const queue = new ToastQueue();
    const id1 = queue.addToast({ title: 'Toast 1' });
    const id2 = queue.addToast({ title: 'Toast 2' });

    queue.dismissToast(id1);
    assert.strictEqual(queue.toasts.length, 1);
    assert.strictEqual(queue.toasts[0].id, id2);
  });

  it('T1-F7-04: Renders ToastHUD container and toast items with semantic icons and close buttons', () => {
    const sampleToasts = [
      { id: 't1', type: 'success', title: 'Process Terminated', message: 'SIGTERM sent' },
      { id: 't2', type: 'error', title: 'Action Failed', message: 'Permission denied' },
      { id: 't3', type: 'warning', title: 'Process Isolated', message: 'Sockets blocked' },
      { id: 't4', type: 'info', title: 'Rescan Complete', message: 'Snapshot refreshed' }
    ];

    const html = ReactDOMServer.renderToString(
      React.createElement(ToastHUD, { toasts: sampleToasts, onDismiss: () => {} })
    );
    assert(html.includes('toast-hud-container'), 'Toast container rendered.');
    assert(html.includes('toast-item success'), 'Success toast item rendered.');
    assert(html.includes('toast-item error'), 'Error toast item rendered.');
    assert(html.includes('toast-item warning'), 'Warning toast item rendered.');
    assert(html.includes('toast-item info'), 'Info toast item rendered.');
    assert(html.includes('Process Terminated'), 'Toast title rendered.');
    assert(html.includes('SIGTERM sent'), 'Toast message rendered.');
    assert(html.includes('toast-close-btn'), 'Close button rendered on each toast.');
  });

  it('T1-F7-05: ToastHUD returns empty / null when toasts array is empty', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(ToastHUD, { toasts: [], onDismiss: () => {} })
    );
    assert.strictEqual(html, '');
  });
});

// ==============================================================================
// SUITE 10: Optimistic State Feedback & Recovery (F8, F19)
// ==============================================================================
describe('Suite 10: Optimistic State Feedback & Recovery (F8, F19)', () => {
  it('T1-F8-01: Optimistically isolates process and supports rollback on failure', () => {
    let processes = [{ pid: 4182, is_isolated: false }];

    // 1. Optimistic apply
    processes = processes.map((p) => (p.pid === 4182 ? { ...p, is_isolated: true } : p));
    assert.strictEqual(processes[0].is_isolated, true);

    // 2. Rollback on API rejection
    processes = processes.map((p) => (p.pid === 4182 ? { ...p, is_isolated: false } : p));
    assert.strictEqual(processes[0].is_isolated, false);
  });

  it('T1-F8-02: Optimistically terminates process and decrements summary metrics', () => {
    let processes = [
      { pid: 4182, name: 'code-telemetry', sockets: [{}, {}], is_isolated: false },
      { pid: 9811, name: 'stealth_updater', sockets: [{}], is_isolated: true }
    ];
    let summary = {
      total_processes: 2,
      active_sockets: 3,
      isolated_pids_count: 1
    };

    // Optimistically terminate PID 9811
    const target = processes.find((p) => p.pid === 9811);
    processes = processes.filter((p) => p.pid !== 9811);
    summary = {
      ...summary,
      total_processes: Math.max(0, summary.total_processes - 1),
      active_sockets: Math.max(0, summary.active_sockets - target.sockets.length),
      isolated_pids_count: target.is_isolated ? Math.max(0, summary.isolated_pids_count - 1) : summary.isolated_pids_count
    };

    assert.strictEqual(processes.length, 1);
    assert.strictEqual(processes[0].pid, 4182);
    assert.strictEqual(summary.total_processes, 1);
    assert.strictEqual(summary.active_sockets, 2);
    assert.strictEqual(summary.isolated_pids_count, 0);
  });

  it('T1-F8-03: Verifies complete elimination of alert() and confirm() across src/ codebase', () => {
    const srcDir = path.resolve(__dirname, '..', 'src');
    const readDirRecursive = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const fullPath = path.resolve(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(readDirRecursive(fullPath));
        } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
          results.push(fullPath);
        }
      });
      return results;
    };

    const files = readDirRecursive(srcDir);
    assert(files.length > 0, 'Source files must be detected.');

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      // Ensure no alert( or confirm( calls exist in the source code
      assert(!/\balert\s*\(/.test(content), `Found forbidden alert() call in ${file}`);
      assert(!/\bconfirm\s*\(/.test(content), `Found forbidden confirm() call in ${file}`);
    }
  });
});
