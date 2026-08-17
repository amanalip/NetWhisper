// Import React library.
import React from 'react';
// Import icons from lucide-react.
import { Search, AlertOctagon, RefreshCw } from 'lucide-react';

/**
 * GlobalControls Component.
 * Provides search filtering, functional category pills, risk filter, and Global Panic switch.
 */
export default function GlobalControls({
  searchQuery,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  activeRisk,
  onRiskChange,
  panicMode,
  onTogglePanic
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

  return (
    <div className="toolbar">
      {/* Search Input Box */}
      <div className="search-box">
        <Search size={16} color="var(--text-muted)" />
        <input
          type="text"
          className="search-input"
          placeholder="Filter by PID, process name, domain, or port..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Category Pills */}
      <div className="filter-pills">
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`pill-btn ${activeCategory === cat.id ? 'active' : ''}`}
            onClick={() => onCategoryChange(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Risk Filter Pills */}
      <div className="filter-pills">
        {risks.map((r) => (
          <button
            key={r.id}
            className={`pill-btn ${activeRisk === r.id ? 'active' : ''}`}
            onClick={() => onRiskChange(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Global Panic Kill Switch */}
      <button
        className={`panic-btn ${panicMode ? 'active' : ''}`}
        onClick={onTogglePanic}
        title="Instantly freezes all outbound non-system sockets"
      >
        <AlertOctagon size={16} />
        <span>{panicMode ? 'PANIC ACTIVE (BLOCKING)' : 'PANIC SWITCH'}</span>
      </button>
    </div>
  );
}
