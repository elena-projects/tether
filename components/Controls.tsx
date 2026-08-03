import React, { useRef, useState, useEffect } from 'react';
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

  return (
    <div className="w-full max-w-md mx-auto space-y-3 select-none touch-none">
      
      {/* 2D Emotion Pad */}
      <div className="space-y-2">

        {/* Energy: high (top) */}
        <div className={`flex justify-center text-[0.625rem] tracking-[0.12em] font-bold opacity-70 pb-1 ${textColor}`}>
             <span>{labels.highEnergy}</span>
        </div>

        <div className="flex items-center gap-3">
           {/* Mood: low (left) */}
           <span className={`text-[0.625rem] tracking-[0.12em] font-bold opacity-70 shrink-0 w-14 text-right ${textColor}`}>{labels.unpleasant}</span>

           {/* Pad Area - Responsive Square */}
           <div
             ref={padRef}
             className="relative flex-1 aspect-square bg-white/10 border border-white/20 cursor-crosshair rounded-lg overflow-hidden backdrop-blur-sm touch-none"
             onPointerDown={handlePointerDown}
             onPointerMove={handlePointerMove}
             onPointerUp={handlePointerUp}
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
           <span className={`text-[0.625rem] tracking-[0.12em] font-bold opacity-70 shrink-0 w-14 text-left ${textColor}`}>{labels.pleasant}</span>
        </div>

        {/* Energy: low (bottom) */}
        <div className={`flex justify-center text-[0.625rem] tracking-[0.12em] font-bold opacity-70 pt-1 ${textColor}`}>
             <span>{labels.lowEnergy}</span>
        </div>
      </div>

    </div>
  );
};

export default Controls;