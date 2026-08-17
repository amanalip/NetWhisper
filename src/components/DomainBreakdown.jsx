// Import React library.
import React from 'react';
// Import icons from lucide-react.
import { Globe, ShieldAlert, ShieldCheck, Activity } from 'lucide-react';

/**
 * DomainBreakdown Component.
 * Visual matrix of contacted remote hostnames, risk assessments, socket counts, and owning processes.
 */
export default function DomainBreakdown({ domains, categories }) {
  // Guard against undefined domain lists.
  const domainList = domains || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Category Distribution Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {categories &&
          Object.entries(categories).map(([catName, count]) => (
            <div
              key={catName}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={16} color="var(--accent-cyan)" />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{catName}</span>
              </div>
              <span style={{ fontSize: '15px', fontWeight: '600', fontFamily: 'var(--font-mono)' }}>{count}</span>
            </div>
          ))}
      </div>

      {/* Domain Breakdown Table */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            background: 'rgba(0, 0, 0, 0.2)',
            borderBottom: '1px solid var(--border-subtle)',
            fontSize: '13px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Globe size={16} color="var(--accent-blue)" />
          <span>Contacted Remote Domains & Telemetry Endpoints ({domainList.length})</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {domainList.map((d, idx) => (
            <div
              key={idx}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 180px 100px 80px 180px',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 16px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)'
              }}
            >
              {/* Domain Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: '500', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {d.domain}
                </span>
              </div>

              {/* Classification Category */}
              <div style={{ color: 'var(--text-secondary)' }}>{d.category}</div>

              {/* Risk Level Badge */}
              <div>
                <span className={`risk-tag ${d.risk}`}>
                  {d.risk === 'high' || d.risk === 'critical' ? <ShieldAlert size={10} /> : <ShieldCheck size={10} />}
                  {d.risk}
                </span>
              </div>

              {/* Active Sockets Count */}
              <div style={{ textAlign: 'center', color: 'var(--accent-cyan)' }}>{d.socket_count} sockets</div>

              {/* Processes using this domain */}
              <div style={{ color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {d.processes ? d.processes.join(', ') : 'None'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
