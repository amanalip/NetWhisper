// Import React library.
import React from 'react';
// Import icons from lucide-react.
// Sun = light mode icon, Moon = dark mode icon.
// Wifi / WifiOff = live vs simulation mode indicator.
import { Shield, Minus, Square, X, Wifi, WifiOff, Sun, Moon } from 'lucide-react';

/**
 * TitleBar Component.
 * Custom frameless desktop header containing:
 *   - NetWhisper brand mark and WebSocket connection beacon
 *   - Engine mode toggle badge (Live Linux vs Simulation)
 *   - Light / Dark theme toggle
 *   - OS window control buttons (Minimize, Maximize, Close)
 *
 * Props:
 *   isConnected   — boolean: true when WebSocket daemon is connected
 *   mode          — 'live' | 'simulation': current engine mode
 *   onToggleMode  — fn: called when user clicks the mode badge
 *   isDark        — boolean: true = dark theme active
 *   onToggleTheme — fn: called when user clicks the sun/moon icon
 */
export default function TitleBar({ isConnected, mode = 'live', onToggleMode, isDark = true, onToggleTheme }) {
  // Check if the Electron IPC bridge is available (desktop app vs browser preview).
  const hasElectron = typeof window !== 'undefined' && Boolean(window.electronAPI);

  // Sends minimize signal to Electron main process.
  const handleMinimize = () => {
    if (hasElectron) window.electronAPI.minimize();
  };

  // Sends maximize / restore signal to Electron main process.
  const handleMaximize = () => {
    if (hasElectron) window.electronAPI.maximize();
  };

  // Sends close signal to Electron main process.
  const handleClose = () => {
    if (hasElectron) window.electronAPI.close();
  };

  return (
    <header className="titlebar">
      {/* Left: Brand mark + daemon connection status beacon */}
      <div className="titlebar-brand">
        {/* Shield icon — the NetWhisper brand glyph */}
        <Shield size={16} color="var(--accent-cyan)" />
        <span>NetWhisper</span>
        {/* Pulsing dot: green = daemon online, red = offline */}
        <div
          className={`titlebar-beacon ${isConnected ? '' : 'offline'}`}
          title={isConnected ? 'Daemon Connected (127.0.0.1:8765)' : 'Daemon Offline'}
        />
      </div>

      {/* Center: Engine Mode Switcher badge */}
      <div className="titlebar-controls" style={{ gap: '10px' }}>
        <button
          type="button"
          onClick={onToggleMode}
          className="action-btn"
          style={{ fontSize: '11px', padding: '3px 10px' }}
          title="Toggle between Live Linux Kernel monitoring and Scenario Simulation"
        >
          {/* Wifi icon = live, WifiOff icon = simulation */}
          {mode === 'live'
            ? <Wifi size={12} color="var(--accent-green)" />
            : <WifiOff size={12} color="var(--accent-amber)" />}
          <span>Mode: {mode.toUpperCase()}</span>
        </button>
      </div>

      {/* Right: Theme toggle + OS window controls */}
      <div className="titlebar-controls">
        {/* Theme toggle: Sun icon visible in dark mode (click to go light), Moon visible in light mode (click to go dark) */}
        <button
          type="button"
          className="titlebar-btn"
          onClick={onToggleTheme}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={{ marginRight: '6px' }}
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Minimize window — uses Electron IPC when available */}
        <button type="button" className="titlebar-btn" onClick={handleMinimize} title="Minimize">
          <Minus size={14} />
        </button>

        {/* Maximize / Restore window */}
        <button type="button" className="titlebar-btn" onClick={handleMaximize} title="Maximize / Restore">
          <Square size={12} />
        </button>

        {/* Close window — red hover state via CSS .close class */}
        <button type="button" className="titlebar-btn close" onClick={handleClose} title="Close">
          <X size={14} />
        </button>
      </div>
    </header>
  );
}
