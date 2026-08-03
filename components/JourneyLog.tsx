import React, { useEffect, useState } from 'react';
import { TetherState } from '../types';

interface LogEntry {
  id: number;
  timestamp: number;
  valence: number;
  arousal: number;
  message: string;
}

export const JourneyLog = ({ version, language }: { version: number; language?: string }) => {
  const zh = language === 'zh';
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    // Load logs from local storage
    try {
        const data = JSON.parse(localStorage.getItem('tether_journey_log') || '[]');
        setLogs(data);
    } catch (e) {
        console.error("Failed to load journey logs", e);
    }
  }, [version]);

  // Helper to calculate color based on emotion (matching App.tsx logic)
  const getEntryColor = (valence: number, arousal: number) => {
    const x = valence / 100;
    const y = arousal / 100;
    
    const interpolate = (start: number[], end: number[], ratio: number) => {
        return start.map((c, i) => c + (end[i] - c) * ratio);
    };
    
    // Colors from App.tsx
    const tl = [185, 28, 28]; // Red
    const bl = [23, 37, 84];  // Blue
    const tr = [234, 88, 12]; // Orange
    const br = [13, 148, 136]; // Teal
    
    const top = interpolate(tl, tr, x);
    const bottom = interpolate(bl, br, x);
    const result = interpolate(bottom, top, y);
    
    return `rgb(${Math.round(result[0])}, ${Math.round(result[1])}, ${Math.round(result[2])})`;
  };

  if (logs.length === 0) return null;

  // ---- Emotion trend: a small curve of how you've felt over time + one gentle observation ----
  const chrono = [...logs].reverse(); // stored newest-first → oldest-first for the chart
  const pts = chrono.map((l, idx) => ({
    x: chrono.length <= 1 ? 50 : (idx / (chrono.length - 1)) * 100,
    y: 100 - Math.max(0, Math.min(100, l.valence)), // higher mood = higher on the chart
  }));
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = pts.length ? `${linePath} L 100 100 L 0 100 Z` : '';
  const avg = (a: LogEntry[]) => (a.length ? a.reduce((s, l) => s + l.valence, 0) / a.length : null);
  const rAvg = avg(logs.slice(0, 5)), pAvg = avg(logs.slice(5, 10));
  let insight: string;
  if (rAvg != null && pAvg != null) {
    const d = rAvg - pAvg;
    insight = d > 6 ? (zh ? '最近你的情绪在慢慢往上走了 🌱' : 'Lately your mood has been lifting a little 🌱')
      : d < -6 ? (zh ? '这段时间你过得有点沉——记得对自己温柔一点 🤍' : "It's been a heavier stretch — be gentle with yourself 🤍")
      : (zh ? '最近你的情绪比较平稳。' : 'Your mood has felt fairly steady lately.');
  } else {
    insight = zh ? '多来记几次，就能看到你情绪的走向了。' : 'Check in a few more times to see how your mood trends.';
  }

  return (
    <div className="w-full max-w-4xl mx-auto mt-16 px-6 pb-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="flex items-center gap-4 mb-8 border-b border-white/10 pb-4">
        <h3 className="text-xs tracking-[0.3em] uppercase font-bold text-white/50">{zh ? '你的足迹' : 'Your Journey'}</h3>
        <div className="h-px flex-1 bg-white/10"></div>
      </div>

      {/* Emotion trend curve + gentle observation */}
      <div className="mb-8 p-5 rounded-2xl bg-white/[0.04] border border-white/10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] tracking-widest uppercase font-bold text-white/40">{zh ? '情绪走向' : 'Mood over time'}</span>
          <span className="text-[10px] text-white/25 font-mono">{zh ? `${logs.length} 次记录` : `${logs.length} check-ins`}</span>
        </div>
        <svg viewBox="0 0 100 44" preserveAspectRatio="none" className="w-full h-24">
          <defs>
            <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--rose)" stopOpacity="0.35" />
              <stop offset="1" stopColor="var(--rose)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1="0" y1="22" x2="100" y2="22" stroke="rgba(255,255,255,0.10)" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
          {areaPath && <path d={areaPath} fill="url(#moodFill)" transform="scale(1,0.44)" />}
          {linePath && <path d={linePath} fill="none" stroke="var(--rose)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" transform="scale(1,0.44)" vectorEffect="non-scaling-stroke" />}
        </svg>
        <p className="text-[13px] text-white/70 leading-relaxed mt-3 font-serif">{insight}</p>
      </div>

      <div className="space-y-4">
        {logs.map(log => {
          const color = getEntryColor(log.valence, log.arousal);
          
          return (
            <div key={log.id} className="group flex flex-col md:flex-row gap-4 md:items-center p-6 bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all duration-300 rounded-sm">
               
               {/* Emotional Coordinates */}
               <div className="flex items-center gap-4 md:w-48 shrink-0">
                  <div 
                    className="w-4 h-4 rounded-full shadow-[0_0_10px_currentColor] transition-transform group-hover:scale-110"
                    style={{ backgroundColor: color, color: color, boxShadow: `0 0 10px ${color}` }}
                  />
                  <div className="flex flex-col">
                     <span className="text-[10px] text-white/40 tracking-widest uppercase">
                        V:{log.valence} / A:{log.arousal}
                     </span>
                     <span className="text-[9px] text-white/20 font-mono">
                        {new Date(log.timestamp).toLocaleDateString()} • {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                     </span>
                  </div>
               </div>

               {/* Message */}
               <div className="flex-1 pl-4 md:pl-8 border-l border-white/10">
                  <p className="text-sm md:text-base font-serif italic text-white/80 leading-relaxed group-hover:text-white transition-colors">
                    "{log.message}"
                  </p>
               </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default JourneyLog;