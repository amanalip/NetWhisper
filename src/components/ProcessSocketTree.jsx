// Import React and hooks.
import React, { useState } from 'react';
// Import icons from lucide-react.
import {
  ChevronDown,
  ChevronRight,
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
 */
export default function ProcessSocketTree({ processes, onIsolate, onKill, onSelectSocket }) {
  // State tracking expanded process cards.
  const [expandedPids, setExpandedPids] = useState(new Set([4182, 5891, 7240, 9811]));

  // Toggle individual process card collapse state.
  const toggleExpand = (pid) => {
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

  // Helper to format byte rates into human-readable strings.
  const formatBandwidth = (bps) => {
    if (!bps || bps === 0) return '0 B/s';
    const bytes = bps / 8;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB/s`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
    return `${Math.round(bytes)} B/s`;
  };

  if (!processes || processes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
        No matching active processes found.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {processes.map((proc) => {
        const isExpanded = expandedPids.has(proc.pid);
        const socketCount = proc.sockets ? proc.sockets.length : 0;
        const isIsolated = proc.is_isolated;

        return (
          <div key={proc.pid} className={`process-card ${isIsolated ? 'isolated' : ''}`}>
            {/* Header with process metadata and action buttons */}
            <div className="process-header" onClick={() => toggleExpand(proc.pid)}>
              <div className="process-title">
                {isExpanded ? <ChevronDown size={18} color="var(--text-muted)" /> : <ChevronRight size={18} color="var(--text-muted)" />}
                <span className="pid-badge">PID {proc.pid}</span>
                <span className="process-name">{proc.name}</span>
                <span className="process-category-tag">{proc.category.replace('_', ' ')}</span>
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
                  Sockets: <span>{socketCount}</span>
                </div>

                {/* Per-Process Action Buttons */}
                <div className="process-actions">
                  <button
                    className={`action-btn isolate ${isIsolated ? 'active' : ''}`}
                    onClick={() => onIsolate(proc.pid, !isIsolated)}
                    title={isIsolated ? 'Restore process network connectivity' : 'Block all outbound sockets for this PID'}
                  >
                    <Slash size={12} />
                    <span>{isIsolated ? 'ISOLATED' : 'ISOLATE'}</span>
                  </button>

                  <button
                    className="action-btn kill"
                    onClick={() => onKill(proc.pid)}
                    title="Send SIGTERM / SIGKILL to terminate process"
                  >
                    <Zap size={12} />
                    <span>KILL</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Sockets Breakdown List */}
            {isExpanded && socketCount > 0 && (
              <div className="socket-list">
                {proc.sockets.map((s, idx) => {
                  const stateClass = s.state.toLowerCase();
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
            )}
          </div>
        );
      })}
    </div>
  );
}
