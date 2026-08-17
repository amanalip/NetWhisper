// Import React library.
import React from 'react';
// Import icons from lucide-react.
import { Shield, Minus, Square, X, Radio, Cpu } from 'lucide-react';

/**
 * TitleBar Component.
 * Frameless desktop header containing status beacon, animated mode switch toggle, and window controls.
 */
export default function TitleBar({ isConnected, mode = 'live', onToggleMode }) {
  // Check if electronAPI is available in the window object.
  const hasElectron = typeof window !== 'undefined' && Boolean(window.electronAPI);

  // Handler for minimize window button with graceful web fallback.
  const handleMinimize = () => {
    if (hasElectron && window.electronAPI?.minimize) {
      window.electronAPI.minimize();
    } else {
      console.info('[TitleBar] Minimize requested (web mode fallback: OS window controls unavailable in browser)');
    }
  };

  // Handler for maximize / restore window button with HTML5 fullscreen web fallback.
  const handleMaximize = () => {
    if (hasElectron && window.electronAPI?.maximize) {
      window.electronAPI.maximize();
    } else {
      // Graceful web fallback: toggle HTML5 fullscreen
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch((err) => {
          console.warn('[TitleBar] Fullscreen request not permitted:', err);
        });
      } else {
        document.exitFullscreen?.().catch((err) => {
          console.warn('[TitleBar] Exit fullscreen error:', err);
        });
      }
    }
  };

  // Handler for close window button with graceful web fallback.
  const handleClose = () => {
    if (hasElectron && window.electronAPI?.close) {
      window.electronAPI.close();
    } else {
      console.info('[TitleBar] Close requested (web mode fallback)');
      try {
        window.close();
      } catch (_) {
        // Ignored in browsers if tab was not script-opened
      }
    }
  };

  return (
    <header className="titlebar">
      {/* Brand Icon and Title */}
      <div className="titlebar-brand">
        <Shield size={16} color="var(--accent-cyan)" />
        <span>NetWhisper</span>
        {/* Connection status beacon */}
        <div
          className={`titlebar-beacon ${isConnected ? '' : 'offline'}`}
          title={isConnected ? 'Daemon Connected (127.0.0.1:8765)' : 'Daemon Offline'}
        />
      </div>

      {/* Center Animated Engine Mode Switcher */}
      <div className="mode-toggle-container">
        <div className="mode-toggle-group" role="group" aria-label="Engine Mode Selector">
          <button
            type="button"
            className={`mode-toggle-btn ${mode === 'live' ? 'active live' : ''}`}
            onClick={() => onToggleMode && onToggleMode('live')}
            title="Live Linux Mode: Real-time kernel socket telemetry via procfs"
            aria-pressed={mode === 'live'}
          >
            {mode === 'live' && <span className="mode-pulse-dot" />}
            <Radio size={12} />
            <span>Live Linux</span>
          </button>

          <button
            type="button"
            className={`mode-toggle-btn ${mode === 'simulation' ? 'active simulation' : ''}`}
            onClick={() => onToggleMode && onToggleMode('simulation')}
            title="Simulation Mode: Synthetic privacy analysis and threat scenarios"
            aria-pressed={mode === 'simulation'}
          >
            <Cpu size={12} />
            <span>Simulation</span>
          </button>
        </div>
      </div>

      {/* Desktop Window Controls (Minimize, Maximize, Close) */}
      <div className="titlebar-controls">
        <button
          type="button"
          className="titlebar-btn"
          onClick={handleMinimize}
          title="Minimize Window"
          aria-label="Minimize Window"
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          className="titlebar-btn"
          onClick={handleMaximize}
          title="Maximize / Restore Window"
          aria-label="Maximize or Restore Window"
        >
          <Square size={12} />
        </button>
        <button
          type="button"
          className="titlebar-btn close"
          onClick={handleClose}
          title="Close Window"
          aria-label="Close Window"
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
}
