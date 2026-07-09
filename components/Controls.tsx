import React, { useRef, useState, useEffect } from 'react';
import { TetherState } from '../types';

interface ControlsProps {
  state: TetherState;
  onChange: (newState: TetherState) => void;
  textColor: string;
  labels: {
    valence: string;
    arousal: string;
    body: string;
    unpleasant: string;
    pleasant: string;
    lowEnergy: string;
    highEnergy: string;
    shattered: string;
    whole: string;
  }
}

const Controls: React.FC<ControlsProps> = ({ state, onChange, textColor, labels }) => {
  const padRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleBodyChange = (value: number) => {
    onChange({ ...state, body: value });
  };

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
    <div className="w-full max-w-md mx-auto space-y-6 mt-4 select-none touch-none">
      
      {/* 2D Emotion Pad */}
      <div className="space-y-1">
        
        {/* Y Axis: Top Label */}
        <div className="flex justify-center items-end text-[0.625rem] tracking-widest font-bold opacity-60 h-4">
             <span>{labels.highEnergy}</span>
        </div>

        <div className="flex items-center gap-2">
           {/* Y Axis: Title (Rotated) */}
           <div className="h-full min-h-[150px] flex items-center justify-center">
             <span className="text-[0.625rem] tracking-[0.2em] font-bold opacity-50 -rotate-90 whitespace-nowrap">
                {labels.arousal}
             </span>
           </div>

           {/* Pad Area - Responsive Square */}
           <div 
             ref={padRef}
             className="relative w-full aspect-square bg-white/10 border border-white/20 cursor-crosshair rounded-md overflow-hidden backdrop-blur-sm touch-none"
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
              
              {/* Corner Labels (Semantics) */}
              <span className="absolute top-2 left-2 text-[8px] opacity-30 pointer-events-none">暴风</span>
              <span className="absolute top-2 right-2 text-[8px] opacity-30 pointer-events-none">烈日</span>
              <span className="absolute bottom-2 left-2 text-[8px] opacity-30 pointer-events-none">阴雨</span>
              <span className="absolute bottom-2 right-2 text-[8px] opacity-30 pointer-events-none">晴朗</span>
           </div>
        </div>

        {/* Y Axis: Bottom Label */}
        <div className="flex justify-center text-[0.625rem] tracking-widest font-bold opacity-60">
             <span>{labels.lowEnergy}</span>
        </div>

        {/* X Axis Labels */}
        <div className="flex justify-between items-center text-[0.625rem] tracking-widest opacity-60 px-0 pt-2">
            <span className="w-1/3 text-left">{labels.unpleasant}</span>
            <span className="w-1/3 text-center font-bold opacity-80">{labels.valence}</span>
            <span className="w-1/3 text-right">{labels.pleasant}</span>
        </div>
      </div>

      {/* Body Slider */}
      <div className="space-y-4 pt-2">
        <div className="flex justify-between items-end px-1">
            <label className={`text-sm tracking-widest font-bold ${textColor}`}>{labels.body}</label>
             <div className="flex gap-2 items-center">
                <span className={`text-lg font-bold ${textColor}`}>{state.body}%</span>
                <span className={`text-xs ${textColor} opacity-60`}>
                    {state.body < 30 ? labels.shattered : state.body > 70 ? labels.whole : ""}
                </span>
            </div>
        </div>
        <div className="flex items-center gap-3 w-full px-1">
            <span className={`text-[10px] ${textColor} opacity-50 whitespace-nowrap`}>0%</span>
            <input
              type="range"
              min="0"
              max="100"
              value={state.body}
              onChange={(e) => handleBodyChange(parseInt(e.target.value))}
              className="flex-1 w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer accent-white hover:accent-gray-300 focus:outline-none touch-manipulation"
            />
            <span className={`text-[10px] ${textColor} opacity-50 whitespace-nowrap`}>100%</span>
        </div>
      </div>

    </div>
  );
};

export default Controls;