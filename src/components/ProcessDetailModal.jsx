// Import React library.
import React from 'react';
// Import icons from lucide-react.
import { X, ShieldAlert, ShieldCheck, Terminal, Cpu, HardDrive, User, Server } from 'lucide-react';

/**
 * ProcessDetailModal Component.
 * Detailed inspector drawer showing low-level socket inode, endpoints, sanitized command line, and process tree context.
 */
export default function ProcessDetailModal({ selectedItem, onClose }) {
  // Return null if no item is selected.
  if (!selectedItem) return null;

  const { process, socket } = selectedItem;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={18} color="var(--accent-cyan)" />
            <span style={{ fontSize: '15px', fontWeight: '600' }}>Socket and Process Deep-Dive Inspector</span>
          </div>
          <button className="titlebar-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Process Metadata Overview */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px'
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--accent-cyan)' }}>
              Process Identity & Resources
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
              <div>
                PID: <span className="font-mono">{process.pid}</span> (PPID: {process.ppid})
              </div>
              <div>
                Name: <span style={{ fontWeight: '500' }}>{process.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Cpu size={12} color="var(--text-muted)" />
                CPU: <span className="font-mono">{process.cpu_percent}%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <HardDrive size={12} color="var(--text-muted)" />
                RAM: <span className="font-mono">{process.memory_mb} MB</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <User size={12} color="var(--text-muted)" />
                Owner: <span>{process.username}</span>
              </div>
              <div>
                Risk Level:{' '}
                <span className={`risk-tag ${process.risk_level}`} style={{ marginLeft: '4px' }}>
                  {process.risk_level}
                </span>
              </div>
            </div>
          </div>

          {/* Sanitized Command Line */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: 'var(--accent-blue)' }}>
              <Terminal size={14} />
              <span>Sanitized Command Line</span>
            </div>
            <div
              className="font-mono"
              style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                wordBreak: 'break-all',
                background: '#04070d',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}
            >
              {process.cmdline}
            </div>
          </div>

          {/* Selected Socket Connection Specifications */}
          {socket && (
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px'
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--accent-green)' }}>
                Socket Connection Details
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                <div>Protocol: <span className="proto-badge">{socket.proto}</span></div>
                <div>Local Endpoint: <span style={{ color: 'var(--text-primary)' }}>{socket.local_ip}:{socket.local_port}</span></div>
                <div>Remote Endpoint: <span style={{ color: 'var(--text-primary)' }}>{socket.remote_ip}:{socket.remote_port}</span></div>
                <div>Resolved Host: <span style={{ color: 'var(--accent-cyan)' }}>{socket.remote_domain || 'N/A'}</span></div>
                <div>Category: <span style={{ color: 'var(--text-secondary)' }}>{socket.category}</span></div>
                <div>State: <span className={`state-badge ${socket.state.toLowerCase()}`}>{socket.state}</span></div>
                <div>Bytes Transferred: Tx: {socket.bytes_sent || 0} bytes | Rx: {socket.bytes_recv || 0} bytes</div>
                <div>Kernel Socket Inode: {socket.inode || 'N/A'}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
