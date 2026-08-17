// Import React and standard hooks.
import React, { useState, useRef, useEffect } from 'react';
// Import icons from lucide-react.
import {
  X,
  ShieldAlert,
  Terminal,
  Cpu,
  HardDrive,
  User,
  Server,
  Copy,
  Check,
  FileJson,
  Slash,
  Zap
} from 'lucide-react';

const PROTECTED_SYSTEM_NAMES = new Set([
  'systemd', 'init', 'kthreadd', 'dbus-daemon',
  'pipewire', 'wireplumber', 'kwin', 'gnome-shell', 'xorg', 'wayland'
]);

/**
 * Safe cross-environment clipboard writing utility.
 * Supports modern navigator.clipboard with textarea fallback for non-secure / headless contexts.
 */
async function copyToClipboard(text) {
  if (!text) return false;

  // 1. Modern navigator.clipboard API
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('[Clipboard] navigator.clipboard failed, attempting fallback...', err);
  }

  // 2. Fallback to hidden textarea with execCommand
  try {
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      textarea.style.opacity = '0';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, 99999);
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      return successful;
    }
  } catch (fallbackErr) {
    console.error('[Clipboard] Fallback copy failed:', fallbackErr);
  }

  return false;
}

/**
 * ProcessDetailModal Component.
 * Detailed inspector drawer showing low-level socket inode, endpoints, sanitized command line,
 * process tree context, instant clipboard copy utilities, and in-drawer lifecycle actions.
 */
export default function ProcessDetailModal({
  selectedItem,
  process: propProcess,
  socket: propSocket,
  onClose,
  onKillProcess,
  onIsolateProcess,
  onToast,
  addToast
}) {
  // Support both selectedItem object and discrete process/socket props
  const process = selectedItem?.process || propProcess;
  const socket = selectedItem?.socket || propSocket;

  // Active copied button state ('cmdline' | 'ip' | 'domain' | 'json' | null)
  const [copiedKey, setCopiedKey] = useState(null);
  const copyTimeoutRef = useRef(null);

  // Clear pending timers on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  // Return null if no process is selected
  if (!process) return null;

  const isIsolated = Boolean(process.is_isolated);
  const isProtected = process.pid <= 1 || PROTECTED_SYSTEM_NAMES.has((process.name || '').toLowerCase());

  // Handle clipboard copy action with 2-second visual feedback badge and optional toast
  const handleCopy = async (key, text, label) => {
    if (!text) return;
    const success = await copyToClipboard(text);
    if (success) {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      setCopiedKey(key);
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedKey(null);
      }, 2000);

      // Trigger optional non-blocking toast
      const toastFn = onToast || addToast;
      if (typeof toastFn === 'function') {
        toastFn({
          type: 'success',
          title: 'Copied to clipboard',
          message: label ? `${label} copied` : 'Text copied to clipboard',
          duration: 2000
        });
      }
    }
  };

  const handleIsolateClick = (e) => {
    e.stopPropagation();
    if (onIsolateProcess) {
      onIsolateProcess(process.pid, !isIsolated, process.name);
    }
  };

  const handleKillClick = (e) => {
    e.stopPropagation();
    if (isProtected) {
      const toastFn = onToast || addToast;
      if (typeof toastFn === 'function') {
        toastFn({
          type: 'error',
          title: 'Protected Process',
          message: `PID ${process.pid} (${process.name}) is a protected system component.`
        });
      }
      return;
    }
    if (onKillProcess) {
      onKillProcess(process.pid, process.name);
      if (onClose) onClose();
    }
  };

  // Generate formatted full process & socket JSON payload
  const getProcessJsonPayload = () => {
    return JSON.stringify(
      {
        process: {
          pid: process.pid,
          ppid: process.ppid,
          name: process.name,
          cmdline: process.cmdline,
          category: process.category,
          cpu_percent: process.cpu_percent,
          memory_mb: process.memory_mb,
          username: process.username,
          risk_level: process.risk_level,
          is_isolated: Boolean(process.is_isolated)
        },
        socket: socket
          ? {
              proto: socket.proto,
              local_ip: socket.local_ip,
              local_port: socket.local_port,
              remote_ip: socket.remote_ip,
              remote_port: socket.remote_port,
              remote_domain: socket.remote_domain || null,
              state: socket.state,
              category: socket.category,
              risk: socket.risk,
              bytes_sent: socket.bytes_sent || 0,
              bytes_recv: socket.bytes_recv || 0,
              inode: socket.inode || null,
              is_encrypted: socket.is_encrypted
            }
          : null,
        exported_at: new Date().toISOString()
      },
      null,
      2
    );
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={18} color="var(--accent-cyan)" />
            <span style={{ fontSize: '15px', fontWeight: '600' }}>
              Socket and Process Deep-Dive Inspector
            </span>
          </div>
          <button className="titlebar-btn close" onClick={onClose} title="Close Inspector">
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
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--accent-cyan)' }}>
                Process Identity & Resources
              </div>
              {isIsolated && (
                <span className="isolated-tag" style={{ fontSize: '11px' }}>
                  <Slash size={10} /> ISOLATED
                </span>
              )}
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

          {/* Sanitized Command Line with Copy Button */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: 'var(--accent-blue)'
                }}
              >
                <Terminal size={14} />
                <span>Sanitized Command Line</span>
              </div>
              <button
                type="button"
                className={`drawer-copy-btn ${copiedKey === 'cmdline' ? 'copied' : ''}`}
                onClick={() => handleCopy('cmdline', process.cmdline || process.name, 'Command line')}
                title="Copy sanitized command line to clipboard"
              >
                {copiedKey === 'cmdline' ? (
                  <>
                    <Check size={12} color="var(--accent-green)" />
                    <span style={{ color: 'var(--accent-green)' }}>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Copy Command</span>
                  </>
                )}
              </button>
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
              {process.cmdline || process.name}
            </div>
          </div>

          {/* Selected Socket Connection Specifications with IP / Domain Copy Buttons */}
          {socket && (
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px'
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  marginBottom: '8px',
                  color: 'var(--accent-green)'
                }}
              >
                Socket Connection Details
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                <div>
                  Protocol: <span className="proto-badge">{socket.proto}</span>
                </div>
                <div>
                  Local Endpoint:{' '}
                  <span style={{ color: 'var(--text-primary)' }}>
                    {socket.local_ip}:{socket.local_port}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span>
                    Remote Endpoint:{' '}
                    <span style={{ color: 'var(--text-primary)' }}>
                      {socket.remote_ip}:{socket.remote_port}
                    </span>
                  </span>
                  {socket.remote_ip && (
                    <button
                      type="button"
                      className={`drawer-inline-copy-btn ${copiedKey === 'ip' ? 'copied' : ''}`}
                      onClick={() => handleCopy('ip', socket.remote_ip, `IP (${socket.remote_ip})`)}
                      title="Copy remote IP"
                    >
                      {copiedKey === 'ip' ? (
                        <>
                          <Check size={11} color="var(--accent-green)" />
                          <span style={{ color: 'var(--accent-green)' }}>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} />
                          <span>Copy IP</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span>
                    Resolved Host:{' '}
                    <span style={{ color: 'var(--accent-cyan)' }}>
                      {socket.remote_domain || 'N/A'}
                    </span>
                  </span>
                  {socket.remote_domain && socket.remote_domain !== 'N/A' && (
                    <button
                      type="button"
                      className={`drawer-inline-copy-btn ${copiedKey === 'domain' ? 'copied' : ''}`}
                      onClick={() => handleCopy('domain', socket.remote_domain, `Domain (${socket.remote_domain})`)}
                      title="Copy resolved domain"
                    >
                      {copiedKey === 'domain' ? (
                        <>
                          <Check size={11} color="var(--accent-green)" />
                          <span style={{ color: 'var(--accent-green)' }}>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} />
                          <span>Copy Domain</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div>
                  Category: <span style={{ color: 'var(--text-secondary)' }}>{socket.category}</span>
                </div>
                <div>
                  State:{' '}
                  <span className={`state-badge ${(socket.state || '').toLowerCase()}`}>
                    {socket.state}
                  </span>
                </div>
                <div>
                  Bytes Transferred: Tx: {socket.bytes_sent || 0} bytes | Rx: {socket.bytes_recv || 0} bytes
                </div>
                <div>Kernel Socket Inode: {socket.inode || 'N/A'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with JSON Copy and In-Drawer Actions */}
        <div className="modal-footer">
          <div className="modal-footer-left">
            <button
              type="button"
              className={`drawer-copy-btn ${copiedKey === 'json' ? 'copied' : ''}`}
              onClick={() => handleCopy('json', getProcessJsonPayload(), 'Process JSON')}
              title="Copy full process and socket JSON payload"
            >
              {copiedKey === 'json' ? (
                <>
                  <Check size={13} color="var(--accent-green)" />
                  <span style={{ color: 'var(--accent-green)', fontWeight: '600' }}>Copied JSON!</span>
                </>
              ) : (
                <>
                  <FileJson size={13} />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
          </div>

          <div className="modal-footer-right">
            {onIsolateProcess && (
              <button
                type="button"
                className={`action-btn isolate ${isIsolated ? 'active' : ''}`}
                onClick={handleIsolateClick}
                title={isIsolated ? 'Restore process network connectivity' : 'Block all process sockets via cgroups'}
              >
                <Slash size={13} />
                <span>{isIsolated ? 'Unisolate' : 'Isolate Process'}</span>
              </button>
            )}

            {onKillProcess && (
              <button
                type="button"
                className="action-btn kill"
                onClick={handleKillClick}
                disabled={isProtected}
                title={isProtected ? 'Protected system process cannot be terminated' : 'Terminate process via signal'}
              >
                <Zap size={13} />
                <span>Terminate Process</span>
              </button>
            )}

            <button type="button" className="reset-filters-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
