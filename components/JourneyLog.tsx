import React, { useEffect, useState } from 'react';
import { TetherState } from '../types';

interface LogEntry {
  id: number;
  timestamp: number;
  valence: number;
  arousal: number;
  message: string;
}

export const JourneyLog = ({ version }: { version: number }) => {
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

  return (
    <div className="w-full max-w-4xl mx-auto mt-16 px-6 pb-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="flex items-center gap-4 mb-8 border-b border-white/10 pb-4">
        <h3 className="text-xs tracking-[0.3em] uppercase font-bold text-white/50">Your Journey</h3>
        <div className="h-px flex-1 bg-white/10"></div>
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