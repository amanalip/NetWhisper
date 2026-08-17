// Import React library.
import React from 'react';
// Import icons from lucide-react.
import { Search, AlertOctagon, RefreshCw, RotateCcw, X } from 'lucide-react';

/**
 * GlobalControls Component.
 * Provides search filtering, functional category pills, risk filter, Quick Rescan button,
 * Reset Filters action, and Global Panic switch.
 */
export default function GlobalControls({
  searchQuery,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  activeRisk,
  onRiskChange,
  panicMode,
  onTogglePanic,
  isRescanning = false,
  onRescan,
  onResetFilters
}) {
  // Category filter list.
  const categories = [
    { id: 'all', label: 'All Processes' },
    { id: 'browser', label: 'Browsers' },
    { id: 'developer_tool', label: 'Dev Tools' },
    { id: 'cli_tool', label: 'CLI Utilities' },
    { id: 'desktop_app', label: 'Desktop Apps' },
    { id: 'background_daemon', label: 'Background Daemons' }
  ];

  // Risk filter list.
  const risks = [
    { id: 'all', label: 'All Risks' },
    { id: 'critical', label: 'Critical' },
    { id: 'high', label: 'High' },
    { id: 'medium', label: 'Medium' },
    { id: 'low', label: 'Low' }
  ];

  // Determine whether any filtering criteria is currently active.
  const hasActiveFilters = Boolean(
    (searchQuery && searchQuery.trim().length > 0) ||
    (activeCategory && activeCategory !== 'all') ||
    (activeRisk && activeRisk !== 'all')
  );

  return (
    <div className="toolbar">
      {/* Search Input Box */}
      <div className="search-box">
        <Search size={16} color="var(--text-muted)" className="search-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="Filter by PID, name, domain, IP, or port..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search filter"
        />
        {searchQuery && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => onSearchChange('')}
            title="Clear search query"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Category Filter Pills */}
      <div className="filter-group">
        <span className="filter-group-label">Category:</span>
        <div className="filter-pills">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`pill-btn ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => onCategoryChange(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Risk Filter Pills */}
      <div className="filter-group">
        <span className="filter-group-label">Risk:</span>
        <div className="filter-pills">
          {risks.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`pill-btn risk-pill ${r.id} ${activeRisk === r.id ? 'active' : ''}`}
              onClick={() => onRiskChange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Action Controls: Reset, Quick Rescan, Panic Switch */}
      <div className="toolbar-actions">
        {hasActiveFilters && (
          <button
            type="button"
            className="reset-filters-btn"
            onClick={onResetFilters}
            title="Reset all active search and filter criteria"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        )}

        {/* Quick Rescan Button */}
        <button
          type="button"
          className={`rescan-btn ${isRescanning ? 'rescanning' : ''}`}
          onClick={onRescan}
          disabled={isRescanning}
          title="Rescan host processes and network sockets immediately"
        >
          <RefreshCw size={14} className={isRescanning ? 'spin-icon' : ''} />
          <span>{isRescanning ? 'Scanning...' : 'Rescan'}</span>
        </button>

        {/* Global Panic Kill Switch */}
        <button
          type="button"
          className={`panic-btn ${panicMode ? 'active' : ''}`}
          onClick={onTogglePanic}
          title="Instantly freezes all outbound non-system sockets"
        >
          <AlertOctagon size={16} />
          <span>{panicMode ? 'PANIC ACTIVE (BLOCKING)' : 'PANIC SWITCH'}</span>
        </button>
      </div>
    </div>
  );
}
