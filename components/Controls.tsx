import React, { useRef, useState } from 'react';
import { TetherState } from '../types';

interface ControlsProps {
  state: TetherState;
  onChange: (newState: TetherState) => void;
  textColor: string;
  labels: {
    valence: string;
    arousal: string;
    unpleasant: string;
    pleasant: string;
    lowEnergy: string;
    highEnergy: string;
  }
}

const Controls: React.FC<ControlsProps> = ({ state, onChange, textColor, labels }) => {
  const padRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const updatePad = (clientX: number, clientY: number) => {
    if (!padRef.current) return;
    const rect = padRef.current.getBoundingClientRect();
    
    let x = (clientX - rect.left) / rect.width;
    let y = 1 - (clientY - rect.top) / rect.height; // Invert Y so bottom is 0

    // Clamp
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));

    onChange({
      ...state,
      valence: Math.round(x * 100),
      arousal: Math.round(y * 100)
    });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updatePad(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      updatePad(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 5;
    let { valence, arousal } = state;

    if (e.key === 'ArrowLeft') valence -= step;
    else if (e.key === 'ArrowRight') valence += step;
    else if (e.key === 'ArrowDown') arousal -= step;
    else if (e.key === 'ArrowUp') arousal += step;
    else return;

    e.preventDefault();
    onChange({
      valence: Math.max(0, Math.min(100, valence)),
      arousal: Math.max(0, Math.min(100, arousal)),
    });
  };

  return (
    <div className="w-full max-w-[340px] mx-auto space-y-2.5 select-none">
      
      {/* 2D Emotion Pad */}
      <div className="space-y-2">

        {/* Energy: high (top) */}
        <div className={`flex justify-center text-[0.625rem] md:text-[0.8rem] tracking-[0.12em] font-bold opacity-70 pb-1 md:pb-2 ${textColor}`}>
             <span>{labels.highEnergy}</span>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
           {/* Mood: low (left) */}
           <span className={`text-[0.625rem] md:text-[0.8rem] tracking-[0.12em] font-bold opacity-70 shrink-0 w-14 md:w-16 text-right ${textColor}`}>{labels.unpleasant}</span>

           {/* Pad Area - Responsive Square */}
           <div
             ref={padRef}
             role="group"
             tabIndex={0}
             aria-label={`${labels.valence}: ${state.valence} / 100. ${labels.arousal}: ${state.arousal} / 100`}
             aria-describedby="emotion-pad-help"
             className="relative flex-1 aspect-square bg-white/10 border border-white/25 cursor-crosshair rounded-lg overflow-hidden backdrop-blur-sm touch-none focus:outline-none focus:ring-2 focus:ring-[var(--rose)] focus:ring-offset-2 focus:ring-offset-transparent"
             onPointerDown={handlePointerDown}
             onPointerMove={handlePointerMove}
             onPointerUp={handlePointerUp}
             onPointerCancel={() => setIsDragging(false)}
             onKeyDown={handleKeyDown}
           >
              {/* Background Gradient Grid Guide */}
              <div className="absolute inset-0 opacity-20 pointer-events-none" 
                   style={{
                     background: `linear-gradient(to right, transparent 49%, white 50%, transparent 51%),
                                  linear-gradient(to bottom, transparent 49%, white 50%, transparent 51%)`
                   }}
              />

              {/* The Dot */}
              <div
                className="absolute w-4 h-4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-75 ease-out pointer-events-none"
                style={{
                  left: `${state.valence}%`,
                  top: `${100 - state.arousal}%`,
                }}
              />
           </div>

           {/* Mood: good (right) */}
           <span className={`text-[0.625rem] md:text-[0.8rem] tracking-[0.12em] font-bold opacity-70 shrink-0 w-14 md:w-16 text-left ${textColor}`}>{labels.pleasant}</span>
        </div>

        {/* Energy: low (bottom) */}
        <div className={`flex justify-center text-[0.625rem] md:text-[0.8rem] tracking-[0.12em] font-bold opacity-70 pt-1 md:pt-2 ${textColor}`}>
             <span>{labels.lowEnergy}</span>
        </div>
      </div>

      <p id="emotion-pad-help" className="sr-only">
        Use left and right arrow keys to change mood. Use up and down arrow keys to change energy.
      </p>

      <div className="grid grid-cols-2 gap-4 rounded-md border border-white/15 bg-white/[0.04] px-3 py-2.5 md:px-4 md:py-3">
        <label className="grid gap-1.5">
          <span className={`flex items-center justify-between gap-2 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.08em] opacity-80 ${textColor}`}>
            <span>{labels.valence}</span>
            <span aria-hidden="true">{state.valence}</span>
          </span>
          <input
            type="range"
            min="0"
            max="100"
            value={state.valence}
            onChange={(e) => onChange({ ...state, valence: Number(e.target.value) })}
            aria-label={labels.valence}
            className="w-full accent-[var(--rose)]"
          />
        </label>
        <label className="grid gap-1.5">
          <span className={`flex items-center justify-between gap-2 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.08em] opacity-80 ${textColor}`}>
            <span>{labels.arousal}</span>
            <span aria-hidden="true">{state.arousal}</span>
          </span>
          <input
            type="range"
            min="0"
            max="100"
            value={state.arousal}
            onChange={(e) => onChange({ ...state, arousal: Number(e.target.value) })}
            aria-label={labels.arousal}
            className="w-full accent-[var(--rose)]"
          />
        </label>
      </div>

    </div>
  );
};

export default Controls;
