// Import React and hooks.
import React, { useState } from 'react';
// Import icons from lucide-react.
import { ListFilter, Download, Pause, Play, AlertCircle, Info } from 'lucide-react';

/**
 * NetworkWaterfall Component.
 * Real-time event log stream displaying connection transitions, kill switches, and telemetry detections.
 */
export default function NetworkWaterfall({ events, onExportLogs }) {
  // State for pausing live stream scrolling.
  const [isPaused, setIsPaused] = useState(false);
  // State for filtering event type.
  const [eventTypeFilter, setEventTypeFilter] = useState('all');

  // Filter events based on active filter.
  const eventList = events || [];
  const filteredEvents = eventList.filter((e) => {
    if (eventTypeFilter === 'all') return true;
    return e.type === eventTypeFilter;
  });

  return (
    <div className="waterfall-container">
      {/* Header and Controls */}
      <div className="waterfall-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600' }}>
          <ListFilter size={16} color="var(--accent-blue)" />
          <span>Real-Time Socket and Telemetry Event Waterfall</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Pause / Resume Button */}
          <button
            className="action-btn"
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? 'Resume live event stream' : 'Pause live event stream'}
          >
            {isPaused ? <Play size={12} color="var(--accent-green)" /> : <Pause size={12} />}
            <span>{isPaused ? 'RESUME' : 'PAUSE'}</span>
          </button>

          {/* Export JSON Button */}
          <button className="action-btn" onClick={onExportLogs} title="Export recorded event log to JSON">
            <Download size={12} />
            <span>EXPORT JSON</span>
          </button>
        </div>
      </div>

      {/* Stream List */}
      <div className="waterfall-list">
        {filteredEvents.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No recent network events recorded yet.
          </div>
        ) : (
          filteredEvents.slice().reverse().map((evt) => {
            const isAlert = evt.type === 'kill' || evt.type === 'panic' || evt.type === 'isolate';
            return (
              <div key={evt.id} className="event-row">
                {/* Timestamp */}
                <span style={{ color: 'var(--text-muted)' }}>{evt.timestamp}</span>

                {/* Event Type Badge */}
                <div>
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      background: isAlert ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      color: isAlert ? 'var(--accent-red)' : 'var(--accent-blue)'
                    }}
                  >
                    {evt.type}
                  </span>
                </div>

                {/* Event Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                  {isAlert ? <AlertCircle size={12} color="var(--accent-red)" /> : <Info size={12} color="var(--accent-cyan)" />}
                  <span style={{ color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {evt.title}
                  </span>
                </div>

                {/* Details snippet */}
                <div style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                  {evt.details && evt.details.signal ? evt.details.signal : 'OK'}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
