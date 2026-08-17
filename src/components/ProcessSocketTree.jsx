// Import React and hooks.
import React, { useState } from 'react';
// Import icons from lucide-react.
import {
  ChevronRight,
  ChevronsUpDown,
  ChevronsDownUp,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Slash,
  Zap,
  Lock,
  Unlock,
  Radio,
  ExternalLink
} from 'lucide-react';

/**
 * ProcessSocketTree Component.
 * Renders hierarchical process list with active sockets, metrics, badges, and kill/isolate actions.
 * Features global Expand/Collapse All header controls and smooth accordion transitions.
 */
export default function ProcessSocketTree({
  processes = [],
  onIsolate,
  onKill,
  onSelectSocket,
  expandedPids: controlledExpandedPids,
  onToggleExpand: controlledToggleExpand,
  onExpandAll: controlledExpandAll,
  onCollapseAll: controlledCollapseAll
}) {
  // Local state fallback for uncontrolled usage.
  const [localExpandedPids, setLocalExpandedPids] = useState(new Set([4182, 5891, 7240, 9811]));

  const isControlled = controlledExpandedPids !== undefined;
  const expandedPids = isControlled ? controlledExpandedPids : localExpandedPids;

  // Toggle individual process card collapse state.
  const toggleExpand = (pid) => {
    if (isControlled && controlledToggleExpand) {
      controlledToggleExpand(pid);
    } else {
      setLocalExpandedPids((prev) => {
        const next = new Set(prev);
        if (next.has(pid)) {
          next.delete(pid);
        } else {
          next.add(pid);
        }
        return next;
      });
    }
  };

  // Expand all currently visible process cards.
  const handleExpandAll = () => {
    const visiblePids = processes.map((p) => p.pid);
    if (isControlled && controlledExpandAll) {
      controlledExpandAll(visiblePids);
    } else {
      setLocalExpandedPids((prev) => {
        const next = new Set(prev);
        visiblePids.forEach((pid) => next.add(pid));
        return next;
      });
    }
  };

  // Collapse all process cards.
  const handleCollapseAll = () => {
    if (isControlled && controlledCollapseAll) {
      controlledCollapseAll();
    } else {
      setLocalExpandedPids(new Set());
    }
  };

  // Helper to format byte rates into human-readable strings.
  const formatBandwidth = (bps) => {
    if (!bps || bps === 0) return '0 B/s';
    const bytes = bps / 8;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB/s`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
    return `${Math.round(bytes)} B/s`;
  };

  const expandedCount = processes.filter((p) => expandedPids.has(p.pid)).length;
  const isAllExpanded = processes.length > 0 && expandedCount === processes.length;
  const isAllCollapsed = expandedCount === 0;

  return (
    <div className="process-tree-container">
      {/* Tree Header & Global Expand/Collapse Controls */}
      <div className="tree-header">
        <div className="tree-header-left">
          <div className="tree-header-title">
            <Layers size={16} color="var(--accent-cyan)" />
            <span>Process Sockets</span>
          </div>
          <div className="tree-count-badge">
            <span className="tree-count-expanded">{expandedCount}</span>
            <span className="tree-count-sep">/</span>
            <span className="tree-count-total">{processes.length}</span>
            <span className="tree-count-label">expanded</span>
          </div>
        </div>

        <div className="tree-header-controls">
          <button
            type="button"
            className="tree-btn expand-all"
            onClick={handleExpandAll}
            disabled={processes.length === 0 || isAllExpanded}
            title="Expand all visible process accordions"
          >
            <ChevronsUpDown size={14} />
            <span>Expand All</span>
          </button>

          <button
            type="button"
            className="tree-btn collapse-all"
            onClick={handleCollapseAll}
            disabled={processes.length === 0 || isAllCollapsed}
            title="Collapse all visible process accordions"
          >
            <ChevronsDownUp size={14} />
            <span>Collapse All</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {processes.length === 0 ? (
        <div className="tree-empty-state">
          No matching active processes found.
        </div>
      ) : (
        /* Process Cards List */
        <div className="process-list">
          {processes.map((proc) => {
            const isExpanded = expandedPids.has(proc.pid);
            const socketCount = proc.sockets ? proc.sockets.length : 0;
            const isIsolated = proc.is_isolated;

            return (
              <div key={proc.pid} className={`process-card ${isIsolated ? 'isolated' : ''}`}>
                {/* Header with process metadata and action buttons */}
                <div className="process-header" onClick={() => toggleExpand(proc.pid)}>
                  <div className="process-title">
                    <ChevronRight
                      size={18}
                      className={`accordion-chevron ${isExpanded ? 'rotated' : ''}`}
                    />
                    <span className="pid-badge">PID {proc.pid}</span>
                    <span className="process-name">{proc.name}</span>
                    <span className="process-category-tag">{(proc.category || '').replace(/_/g, ' ')}</span>
                    <span className={`risk-tag ${proc.risk_level}`}>
                      {proc.risk_level === 'high' || proc.risk_level === 'critical' ? (
                        <ShieldAlert size={12} />
                      ) : (
                        <ShieldCheck size={12} />
                      )}
                      {proc.risk_level}
                    </span>
                  </div>

                  {/* Resource Metrics & Action Controls */}
                  <div className="process-metrics" onClick={(e) => e.stopPropagation()}>
                    <div className="metric-pill">
                      CPU: <span>{proc.cpu_percent}%</span>
                    </div>
                    <div className="metric-pill">
                      RAM: <span>{proc.memory_mb} MB</span>
                    </div>
                    <div className="metric-pill">
                      Sockets: <span style={{ color: socketCount > 0 ? 'var(--accent-cyan)' : 'inherit' }}>{socketCount}</span>
                    </div>

                    {/* Per-Process Action Buttons */}
                    <div className="process-actions">
                      <button
                        type="button"
                        className={`action-btn isolate ${isIsolated ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onIsolate(proc.pid, !isIsolated);
                        }}
                        title={isIsolated ? 'Restore process network connectivity' : 'Block all outbound sockets for this PID'}
                      >
                        <Slash size={12} />
                        <span>{isIsolated ? 'ISOLATED' : 'ISOLATE'}</span>
                      </button>

                      <button
                        type="button"
                        className="action-btn kill"
                        onClick={(e) => {
                          e.stopPropagation();
                          onKill(proc.pid);
                        }}
                        title="Send SIGTERM / SIGKILL to terminate process"
                      >
                        <Zap size={12} />
                        <span>KILL</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Animated Sockets Breakdown Accordion Body */}
                <div className={`process-accordion-wrapper ${isExpanded ? 'open' : ''}`}>
                  <div className="process-accordion-content">
                    {socketCount > 0 ? (
                      <div className="socket-list">
                        {proc.sockets.map((s, idx) => {
                          const stateClass = (s.state || '').toLowerCase();
                          return (
                            <div
                              key={idx}
                              className="socket-item"
                              onClick={() => onSelectSocket({ process: proc, socket: s })}
                              style={{ cursor: 'pointer' }}
                              title="Click to view deep-dive socket details"
                            >
                              {/* Protocol Badge */}
                              <span className="proto-badge">{s.proto}</span>

                              {/* Local Endpoint */}
                              <span style={{ color: 'var(--text-secondary)' }}>
                                {s.local_ip}:{s.local_port}
                              </span>

                              {/* Remote Domain / Endpoint */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                {s.is_encrypted ? (
                                  <Lock size={12} color="var(--accent-green)" />
                                ) : (
                                  <Unlock size={12} color="var(--accent-amber)" />
                                )}
                                <span style={{ color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                  {s.remote_domain || s.remote_ip}:{s.remote_port}
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({s.category})</span>
                              </div>

                              {/* Connection State Badge */}
                              <div>
                                <span className={`state-badge ${stateClass}`}>{s.state}</span>
                              </div>

                              {/* Live Bandwidth Rate */}
                              <div style={{ textAlign: 'right', color: 'var(--accent-cyan)' }}>
                                {formatBandwidth((s.bandwidth_out_bps || 0) + (s.bandwidth_in_bps || 0))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="no-sockets-message">
                        <Radio size={13} color="var(--text-muted)" />
                        <span>No active network sockets detected for this process.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
