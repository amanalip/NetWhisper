// Import React and hooks.
import React, { useEffect } from 'react';
// Import icons from lucide-react.
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

/**
 * Individual Toast Item Component.
 * Automatically schedules timer cleanup on mount/unmount and renders semantic styling.
 */
function ToastItem({ toast, onDismiss }) {
  const { id, type = 'info', title, message, duration = 4000 } = toast;

  // Schedule auto-dismiss timer
  useEffect(() => {
    if (duration > 0 && duration !== Infinity) {
      const timer = setTimeout(() => {
        onDismiss(id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onDismiss]);

  // Select appropriate Lucide icon by toast type
  const renderIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={18} />;
      case 'error':
        return <XCircle size={18} />;
      case 'warning':
        return <AlertTriangle size={18} />;
      case 'info':
      default:
        return <Info size={18} />;
    }
  };

  return (
    <div
      className={`toast-item ${type}`}
      role={type === 'error' ? 'alert' : 'status'}
      aria-atomic="true"
    >
      {/* Semantic Icon */}
      <div className="toast-icon-wrapper">{renderIcon()}</div>

      {/* Title & Message Content */}
      <div className="toast-content">
        <div className="toast-title">{title}</div>
        {message && <div className="toast-message">{message}</div>}
      </div>

      {/* Manual Dismiss Button */}
      <button
        type="button"
        className="toast-close-btn"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
        title="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/**
 * ToastHUD Component.
 * Non-blocking floating HUD container that renders active toasts.
 */
export default function ToastHUD({ toasts = [], onDismiss = () => {} }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      className="toast-hud-container"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
