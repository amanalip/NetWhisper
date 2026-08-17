// Import React and hooks.
import React, { useRef, useEffect } from 'react';
// Import icons from lucide-react.
import { BarChart3, TrendingUp } from 'lucide-react';

/**
 * PacketHeatmap Component.
 * High-performance HTML5 Canvas rendering real-time 2D activity heatmap and throughput waveform.
 */
export default function PacketHeatmap({ history, bandwidthIn, bandwidthOut }) {
  // Canvas DOM references.
  const heatmapCanvasRef = useRef(null);
  const waveformCanvasRef = useRef(null);

  // Maximum historical slices to store in memory.
  const historyRef = useRef([]);

  // Update history buffer on new data ticks.
  useEffect(() => {
    if (history) {
      historyRef.current.push({
        time: Date.now(),
        tx: bandwidthOut || 0,
        rx: bandwidthIn || 0,
        ...history
      });
      // Keep last 60 ticks (representing ~6 seconds at 10Hz).
      if (historyRef.current.length > 60) {
        historyRef.current.shift();
      }
    }
  }, [history, bandwidthIn, bandwidthOut]);

  // Main animation / rendering loop using requestAnimationFrame.
  useEffect(() => {
    let animationFrameId;

    const render = () => {
      const hCanvas = heatmapCanvasRef.current;
      const wCanvas = waveformCanvasRef.current;

      // 1. Render 2D Activity Heatmap.
      if (hCanvas) {
        const ctx = hCanvas.getContext('2d');
        const width = hCanvas.width;
        const height = hCanvas.height;

        // Clear background with dark canvas tone.
        ctx.fillStyle = '#080c14';
        ctx.fillRect(0, 0, width, height);

        // Draw horizontal grid guide lines.
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        const rowCount = 6;
        const rowHeight = height / rowCount;

        for (let i = 1; i < rowCount; i++) {
          ctx.beginPath();
          ctx.moveTo(0, i * rowHeight);
          ctx.lineTo(width, i * rowHeight);
          ctx.stroke();
        }

        // Draw active heatmap blocks for each historical tick.
        const ticks = historyRef.current;
        const colWidth = width / 60;

        ticks.forEach((tick, colIndex) => {
          const x = colIndex * colWidth;
          // Calculate intensity based on simulated category activity or bandwidth.
          const intensity = Math.min(1.0, (tick.tx + tick.rx) / 50000);

          for (let row = 0; row < rowCount; row++) {
            const y = row * rowHeight;
            // Modulate color by row and activity.
            const alpha = Math.max(0.05, Math.sin(colIndex * 0.3 + row) * 0.5 + 0.5) * (0.2 + intensity * 0.8);

            if (row === 0 || row === 1) {
              // High-risk telemetry rows (amber/red glow).
              ctx.fillStyle = `rgba(249, 115, 22, ${alpha})`;
            } else {
              // Regular traffic rows (cyan/blue glow).
              ctx.fillStyle = `rgba(0, 210, 255, ${alpha})`;
            }

            // Draw block with subtle spacing.
            ctx.fillRect(x + 1, y + 1, colWidth - 2, rowHeight - 2);
          }
        });
      }

      // 2. Render Throughput Waveform.
      if (wCanvas) {
        const ctx = wCanvas.getContext('2d');
        const width = wCanvas.width;
        const height = wCanvas.height;

        ctx.fillStyle = '#0a0f1d';
        ctx.fillRect(0, 0, width, height);

        const ticks = historyRef.current;
        if (ticks.length > 1) {
          const step = width / (ticks.length - 1);

          // Draw Inbound (Rx) Waveform (Green).
          ctx.beginPath();
          ctx.strokeStyle = '#00e699';
          ctx.lineWidth = 2;
          ticks.forEach((t, i) => {
            const normalized = Math.min(1, t.rx / 80000);
            const y = height - normalized * (height - 10) - 5;
            if (i === 0) ctx.moveTo(0, y);
            else ctx.lineTo(i * step, y);
          });
          ctx.stroke();

          // Draw Outbound (Tx) Waveform (Cyan).
          ctx.beginPath();
          ctx.strokeStyle = '#00d2ff';
          ctx.lineWidth = 2;
          ticks.forEach((t, i) => {
            const normalized = Math.min(1, t.tx / 80000);
            const y = height - normalized * (height - 10) - 5;
            if (i === 0) ctx.moveTo(0, y);
            else ctx.lineTo(i * step, y);
          });
          ctx.stroke();
        }
      }

      // Request next animation frame.
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    // Clean up animation loop on unmount.
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
      {/* 2D Activity Heatmap Box */}
      <div className="heatmap-container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600' }}>
            <BarChart3 size={16} color="var(--accent-cyan)" />
            <span>Packet Volume Activity Heatmap (Time vs Activity Frequency)</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--risk-high)' }}>● Telemetry Beacons</span>
            <span style={{ color: 'var(--accent-cyan)' }}>● Standard Sockets</span>
          </div>
        </div>
        <canvas ref={heatmapCanvasRef} width={600} height={200} className="heatmap-canvas" />
      </div>

      {/* Live Bandwidth Waveform Box */}
      <div className="heatmap-container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600' }}>
            <TrendingUp size={16} color="var(--accent-green)" />
            <span>Throughput Velocity</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--accent-green)' }}>● Rx (In)</span>
            <span style={{ color: 'var(--accent-cyan)' }}>● Tx (Out)</span>
          </div>
        </div>
        <canvas ref={waveformCanvasRef} width={300} height={200} className="heatmap-canvas" />
      </div>
    </div>
  );
}
