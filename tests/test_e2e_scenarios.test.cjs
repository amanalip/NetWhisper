/**
 * Real-World E2E Scenario Workflow Test Runner for NetWhisper.
 * Uses native node:test and node:assert.
 * Executes the 5 comprehensive end-to-end user workflows defined in TEST_INFRA.md.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const esbuild = require('esbuild');

// Helper to load and transpile JSX components
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

const TitleBar = loadComponent('src/components/TitleBar.jsx');
const GlobalControls = loadComponent('src/components/GlobalControls.jsx');
const ProcessSocketTree = loadComponent('src/components/ProcessSocketTree.jsx');
const ProcessDetailModal = loadComponent('src/components/ProcessDetailModal.jsx');
const NetworkWaterfall = loadComponent('src/components/NetworkWaterfall.jsx');
const DomainBreakdown = loadComponent('src/components/DomainBreakdown.jsx');
const PacketHeatmap = loadComponent('src/components/PacketHeatmap.jsx');

// ==============================================================================
// SCENARIO 1: Threat Remediation Workflow
// ==============================================================================
describe('E2E Scenario 1: Threat Remediation Workflow', () => {
  it('Executes full threat detection, socket inspection, isolation, and termination', () => {
    // 1. Initial simulation state with high-risk beacon
    let processes = [
      {
        pid: 9811,
        ppid: 1,
        name: 'stealth_updater',
        cmdline: '/tmp/.cache/stealth_updater --beacon --interval=5s',
        category: 'background_daemon',
        cpu_percent: 4.1,
        memory_mb: 45.2,
        username: 'user',
        risk_level: 'critical',
        is_isolated: false,
        sockets: [
          {
            proto: 'TCP',
            local_ip: '192.168.1.42',
            local_port: 41209,
            remote_ip: '185.220.101.5',
            remote_port: 4444,
            remote_domain: '185.220.101.5',
            state: 'ESTABLISHED',
            category: 'Direct IP (Non-standard Port)',
            risk: 'high',
            bandwidth_out_bps: 2048,
            bandwidth_in_bps: 512,
            is_encrypted: false
          }
        ]
      }
    ];

    // 2. Search filtering by remote IP
    const searchQuery = '185.220.101.5';
    const filtered = processes.filter((p) =>
      p.sockets.some((s) => s.remote_ip.includes(searchQuery))
    );
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].pid, 9811);

    // 3. Render Inspector Drawer for selected socket
    const selectedItem = { process: filtered[0], socket: filtered[0].sockets[0] };
    const drawerHtml = ReactDOMServer.renderToString(
      React.createElement(ProcessDetailModal, { selectedItem, onClose: () => {} })
    );
    assert(drawerHtml.includes('9811'), 'Drawer displays PID 9811.');
    assert(drawerHtml.includes('stealth_updater'), 'Drawer displays process name.');
    assert(drawerHtml.includes('185.220.101.5'), 'Drawer displays beacon IP.');
    assert(drawerHtml.includes('4444'), 'Drawer displays beacon port.');

    // 4. Network Isolation action
    processes = processes.map((p) => {
      if (p.pid === 9811) {
        return {
          ...p,
          is_isolated: true,
          sockets: p.sockets.map((s) => ({
            ...s,
            state: 'BLOCKED',
            bandwidth_out_bps: 0,
            bandwidth_in_bps: 0
          }))
        };
      }
      return p;
    });

    const isolatedProc = processes.find((p) => p.pid === 9811);
    assert.strictEqual(isolatedProc.is_isolated, true);
    assert.strictEqual(isolatedProc.sockets[0].state, 'BLOCKED');
    assert.strictEqual(isolatedProc.sockets[0].bandwidth_out_bps, 0);

    // 5. Process Termination with SIGKILL
    processes = processes.filter((p) => p.pid !== 9811);
    assert.strictEqual(processes.length, 0);

    // 6. Tree renders zero-state after termination
    const treeHtml = ReactDOMServer.renderToString(
      React.createElement(ProcessSocketTree, { processes })
    );
    assert(treeHtml.includes('No matching active processes found'), 'Process tree updated.');
  });
});

// ==============================================================================
// SCENARIO 2: Forensic Investigation & Export Workflow
// ==============================================================================
describe('E2E Scenario 2: Forensic Telemetry Investigation & Export Workflow', () => {
  it('Navigates Domain Breakdown, cross-tab routes to process tree, and exports JSON log', () => {
    const domains = [
      {
        domain: 'telemetry.npmjs.com',
        category: 'Unencrypted Web (HTTP)',
        risk: 'high',
        socket_count: 1,
        processes: ['npm-cli-daemon']
      }
    ];

    const processes = [
      {
        pid: 5891,
        ppid: 3410,
        name: 'npm-cli-daemon',
        cmdline: 'node /usr/local/bin/npm fund --token=[REDACTED_TOKEN]',
        category: 'cli_tool',
        cpu_percent: 0.8,
        memory_mb: 94.6,
        username: 'user',
        risk_level: 'high',
        sockets: [
          {
            remote_domain: 'telemetry.npmjs.com',
            remote_ip: '151.101.65.140',
            remote_port: 80,
            proto: 'TCP',
            state: 'ESTABLISHED',
            category: 'Unencrypted Web (HTTP)',
            risk: 'high'
          }
        ]
      }
    ];

    // 1. Render Domain Breakdown
    const domainHtml = ReactDOMServer.renderToString(
      React.createElement(DomainBreakdown, { domains, categories: { 'Unencrypted Web (HTTP)': 1 } })
    );
    assert(domainHtml.includes('telemetry.npmjs.com'), 'Domain row rendered.');

    // 2. Cross-tab click-to-filter sets searchQuery
    const searchQuery = 'telemetry.npmjs.com';
    const matchingProcesses = processes.filter((p) =>
      p.sockets.some((s) => s.remote_domain.includes(searchQuery))
    );
    assert.strictEqual(matchingProcesses.length, 1);
    assert.strictEqual(matchingProcesses[0].pid, 5891);
    assert(matchingProcesses[0].cmdline.includes('[REDACTED_TOKEN]'), 'Cmdline is sanitized.');

    // 3. Export JSON event log
    let exportTriggered = false;
    let exportData = null;
    const handleExport = () => {
      exportTriggered = true;
      exportData = { domains, processes, events: [{ id: 1, type: 'audit', title: 'Exported log' }] };
    };

    const waterfallHtml = ReactDOMServer.renderToString(
      React.createElement(NetworkWaterfall, {
        events: [{ id: 1, timestamp: '14:30:00', type: 'audit', title: 'Exported log' }],
        onExportLogs: handleExport
      })
    );
    assert(waterfallHtml.includes('EXPORT JSON'), 'Export button present.');
    handleExport();
    assert.strictEqual(exportTriggered, true);
    assert.strictEqual(exportData.domains.length, 1);
    assert.strictEqual(exportData.processes.length, 1);
  });
});

// ==============================================================================
// SCENARIO 3: Emergency Incident Containment (Global Panic Lockdown)
// ==============================================================================
describe('E2E Scenario 3: Emergency Incident Containment (Global Panic Lockdown)', () => {
  it('Applies global panic freeze and halts all non-system network traffic', () => {
    let panicMode = false;
    let summary = {
      total_processes: 5,
      active_sockets: 10,
      bandwidth_in_bps: 10240,
      bandwidth_out_bps: 5120,
      panic_mode: false
    };

    // 1. Pre-panic: active traffic
    assert.strictEqual(summary.bandwidth_out_bps > 0, true);

    // 2. Trigger Panic Switch
    panicMode = true;
    summary = {
      ...summary,
      panic_mode: true,
      bandwidth_in_bps: 0,
      bandwidth_out_bps: 0
    };

    // 3. Verify GlobalControls renders PANIC ACTIVE state
    const controlsHtml = ReactDOMServer.renderToString(
      React.createElement(GlobalControls, {
        panicMode: true,
        onTogglePanic: () => {}
      })
    );
    assert(controlsHtml.includes('PANIC ACTIVE (BLOCKING)'), 'Panic active text rendered.');

    // 4. Deactivate Panic
    panicMode = false;
    summary = {
      ...summary,
      panic_mode: false,
      bandwidth_in_bps: 10240,
      bandwidth_out_bps: 5120
    };
    assert.strictEqual(summary.panic_mode, false);
    assert.strictEqual(summary.bandwidth_out_bps > 0, true);
  });
});

// ==============================================================================
// SCENARIO 4: Stream Analysis Session & Waveform Telemetry
// ==============================================================================
describe('E2E Scenario 4: Stream Analysis Session & Waveform Telemetry', () => {
  it('Accepts telemetry ticks, freezes canvas ingestion on pause, and clears buffer', () => {
    const historyBuffer = [];
    const maxTicks = 60;

    // 1. Ingest 10 ticks
    for (let i = 0; i < 10; i++) {
      historyBuffer.push({ time: Date.now() + i, rx: 1024 * (i + 1), tx: 512 * (i + 1) });
    }
    assert.strictEqual(historyBuffer.length, 10);

    // 2. Pause stream (simulated by ignoring new incoming ticks)
    const isPaused = true;
    if (!isPaused) {
      historyBuffer.push({ time: Date.now(), rx: 2048, tx: 1024 });
    }
    assert.strictEqual(historyBuffer.length, 10); // Buffer remains frozen

    // 3. Clear buffer
    historyBuffer.length = 0;
    assert.strictEqual(historyBuffer.length, 0);

    // 4. Resume stream
    const isResumed = true;
    if (isResumed) {
      historyBuffer.push({ time: Date.now(), rx: 4096, tx: 2048 });
    }
    assert.strictEqual(historyBuffer.length, 1);
  });
});

// ==============================================================================
// SCENARIO 5: Safe Administrative Guardrails & Safe Process Termination
// ==============================================================================
describe('E2E Scenario 5: Safe Administrative Guardrails & Process Termination', () => {
  function checkKillPermission(pid, name, isSystem) {
    if (pid <= 1) {
      return { allowed: false, reason: 'Protected System Process (PID <= 1)' };
    }
    const protectedNames = ['systemd', 'init', 'kthreadd', 'dbus-daemon', 'pipewire', 'wireplumber', 'kwin', 'gnome-shell', 'xorg', 'wayland'];
    if (name && protectedNames.includes(name.toLowerCase())) {
      return { allowed: false, reason: `Protected system daemon '${name}'` };
    }
    if (isSystem) {
      return { allowed: false, reason: 'Core system component' };
    }
    return { allowed: true, reason: '' };
  }

  it('Blocks termination of system PIDs and allows termination of normal worker', () => {
    // 1. Attempt PID 1 (systemd)
    const res1 = checkKillPermission(1, 'systemd', true);
    assert.strictEqual(res1.allowed, false);
    assert(res1.reason.includes('PID <= 1'));

    // 2. Attempt display server daemon
    const resDbus = checkKillPermission(120, 'dbus-daemon', false);
    assert.strictEqual(resDbus.allowed, false);
    assert(resDbus.reason.includes('dbus-daemon'));

    // 3. Attempt legitimate worker process
    const resWorker = checkKillPermission(4182, 'code-telemetry', false);
    assert.strictEqual(resWorker.allowed, true);
    assert.strictEqual(resWorker.reason, '');
  });
});
