// Import React library.
import React from 'react';
// Import icons from lucide-react.
import { Shield, Minus, Square, X, Wifi, WifiOff } from 'lucide-react';

/**
 * TitleBar Component.
 * Custom frameless desktop header containing status beacon, window controls, and engine mode indicator.
 */
export default function TitleBar({ isConnected, mode, onToggleMode }) {
  // Check if electronAPI is available in the window object.
  const hasElectron = typeof window !== 'undefined' && Boolean(window.electronAPI);

  // Handler for minimize window button.
  const handleMinimize = () => {
    if (hasElectron) window.electronAPI.minimize();
  };

  // Handler for maximize / restore window button.
  const handleMaximize = () => {
    if (hasElectron) window.electronAPI.maximize();
  };

  // Handler for close window button.
  const handleClose = () => {
    if (hasElectron) window.electronAPI.close();
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
          title={isConnected ? 'Daemon Connected (127.0.0.1)' : 'Daemon Offline'}
        />
      </div>

      {/* Center Mode Switcher Badge */}
      <div className="titlebar-controls" style={{ gap: '10px' }}>
        <button
          onClick={onToggleMode}
          className="action-btn"
          style={{ fontSize: '11px', padding: '3px 8px' }}
          title="Click to toggle between Live Linux Kernel and Scenario Simulation mode"
        >
          {mode === 'live' ? <Wifi size={12} color="var(--accent-green)" /> : <WifiOff size={12} color="var(--accent-amber)" />}
          <span>Mode: {mode.toUpperCase()}</span>
        </button>
      </div>

      {/* Desktop Window Controls (Minimize, Maximize, Close) */}
      <div className="titlebar-controls">
        <button className="titlebar-btn" onClick={handleMinimize} title="Minimize">
          <Minus size={14} />
        </button>
        <button className="titlebar-btn" onClick={handleMaximize} title="Maximize">
          <Square size={12} />
        </button>
        <button className="titlebar-btn close" onClick={handleClose} title="Close">
          <X size={14} />
        </button>
      </div>
    </header>
  );
}
