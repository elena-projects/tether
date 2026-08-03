import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { TetherState } from '../types';

interface OrbCanvasProps {
  state: TetherState;
  isHealing?: boolean; // New prop for Somatic Regulation mode
  isPulsing?: boolean; // New prop for generic gentle pulse notification
}

const OrbCanvas: React.FC<OrbCanvasProps> = ({ state, isHealing = false, isPulsing = false }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const timeRef = useRef(0);
  const requestRef = useRef<number>(null);
  
  // Track "visual healing" progress independent of actual state
  // This allows the orb to look like it's repairing while the user breathes
  const healingProgressRef = useRef(0); 

  const size = 400;

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    
    // Add Glow Definition
    if (svg.select("#glow").empty()) {
      const defs = svg.append("defs");
      const filter = defs.append("filter")
        .attr("id", "glow")
        .attr("x", "-50%")
        .attr("y", "-50%")
        .attr("width", "200%")
        .attr("height", "200%");
      
      filter.append("feGaussianBlur")
        .attr("stdDeviation", "8")
        .attr("result", "coloredBlur");

      const merge = filter.append("feMerge");
      merge.append("feMergeNode").attr("in", "coloredBlur");
      merge.append("feMergeNode").attr("in", "SourceGraphic");
    }

    // Add Text Element for Breathing Guide
    let textGroup = svg.select(".breath-text");
    if (textGroup.empty()) {
      textGroup = svg.append("g")
        .attr("class", "breath-text")
        .attr("transform", `translate(${size/2}, ${size - 40})`);
      
      textGroup.append("text")
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .attr("font-family", "Courier Prime, monospace")
        .attr("font-size", "14px")
        .attr("letter-spacing", "0.2em")
        .style("opacity", 0);
    }

    // Animation Loop — throttled to ~30fps. The orb tears down and rebuilds the whole SVG
    // (with a glow filter) on each draw, which is expensive on phones. Time advances by real
    // elapsed seconds (dt) so breathing speed is identical regardless of frame rate.
    let lastDraw = 0;
    const animate = (time: number) => {
      requestRef.current = requestAnimationFrame(animate);
      if (time - lastDraw < 33) return;                 // cap the expensive redraw at ~30fps
      const dt = lastDraw ? Math.min((time - lastDraw) / 1000, 0.1) : 1 / 30;
      lastDraw = time;

      // 1. Time Management
      let breathCycle = 0;
      let breathScale = 1;

      if (isHealing) {
        timeRef.current += dt; // real seconds
        // Cycle is 0 to 1 over 8 seconds
        const cycleProgress = (timeRef.current % 8) / 8;
        // Sine wave for breathing (starts at 0, goes to 1, back to 0)
        breathCycle = Math.sin(cycleProgress * Math.PI * 2 - (Math.PI / 2)) * 0.5 + 0.5;
        
        // Healing Progress (Visual repair of cracks)
        // Increases slowly as long as isHealing is true
        healingProgressRef.current = Math.min(healingProgressRef.current + dt * 0.12, 1);
      } else {
        timeRef.current += dt * 0.6;
        const breathSpeed = 1 + (state.arousal / 50);
        breathCycle = Math.sin(timeRef.current * breathSpeed) * 0.5 + 0.5; // Normalized 0-1
        
        // Reset healing progress if not healing
        healingProgressRef.current = Math.max(healingProgressRef.current - dt * 3, 0);
      }

      // Map breath cycle to radius scale (1.0 to 1.15)
      breathScale = 1 + (breathCycle * 0.15);
      
      if (isPulsing) {
        // Overlay a rapid, smooth pulse when triggered
        breathScale += Math.sin(timeRef.current * 10) * 0.1;
      }

      // --- Clear & Setup ---
      svg.selectAll("g.orb-group").remove();
      const centerX = size / 2;
      const centerY = size / 2;
      const baseRadius = size / 3;
      const radius = baseRadius * breathScale;

      // --- Color Logic (warm terracotta/clay: a soft "warm light" band) ---
      let saturation = 32 + (state.valence * 0.14); // muted 32–46%
      let lightness = 58 + (state.valence * 0.12);  // soft 58–70%
      let hue = 0;

      if (isPulsing) {
        hue = 20; // warm terracotta glow
        saturation = 46;
        lightness = 70;
      } else if (isHealing) {
        // breathe around a calming warm clay during healing
        hue = 22 + (Math.sin(timeRef.current) * 6);
        saturation = 40;
      } else if (state.arousal > 50) {
         hue = 28 - (state.valence * 0.06); // energetic → warm terracotta
      } else {
         hue = 18 + (state.valence * 0.08); // calm → soft clay
      }
      const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

      // --- Wholeness/Crack Logic with Healing ---
      // Feeling low (low valence) fractures the orb; it visually mends as healingProgressRef
      // rises during a soothing breath, even before the underlying mood changes.
      // Wholeness is remapped so the orb stays a coherent single sphere at neutral/positive
      // mood (≥45) and only visibly cracks apart as mood drops toward the low end — the
      // fragments then read as "fragile right now" instead of being ambient noise.
      const visualBodyState = Math.min(100, state.valence + (healingProgressRef.current * 50));
      const wholeness = Math.max(0, Math.min(1, (visualBodyState - 15) / 30)); // 0 at ≤15, 1 at ≥45

      const segmentCount = wholeness > 0.92 ? 1 : Math.max(2, Math.floor((1 - wholeness) * 32) + 2);
      const gapSize = wholeness > 0.92 ? 0 : (1 - wholeness) * 0.26;
      const displacement = wholeness > 0.92 ? 0 : (1 - wholeness) * 22;

      const pie = d3.pie<number>().value(1).padAngle(gapSize).sort(null);
      const data = new Array(segmentCount).fill(1);
      const arcs = pie(data);

      const arcGenerator = d3.arc<any>()
        .innerRadius(radius - 2)
        .outerRadius(radius + 2)
        .cornerRadius(2);

      const group = svg.append("g")
        .attr("class", "orb-group")
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .style("filter", "url(#glow)"); 

      // --- Draw Segments ---
      group.selectAll("path")
        .data(arcs)
        .enter()
        .append("path")
        .attr("d", arcGenerator)
        .attr("fill", color)
        .attr("stroke", `hsl(${hue}, ${saturation}%, ${lightness + 20}%)`)
        .attr("stroke-width", 1)
        .attr("transform", (d, i) => {
           let jitterX = 0;
           let jitterY = 0;
           
           // Reduce jitter during healing
           const arousalFactor = isHealing ? Math.max(0, state.arousal - (healingProgressRef.current * 100)) : state.arousal;

           if (arousalFactor > 70) {
              const intensity = (arousalFactor - 70) * 0.05;
              jitterX = (Math.random() - 0.5) * intensity;
              jitterY = (Math.random() - 0.5) * intensity;
           }

           if (displacement > 0) {
             const [x, y] = arcGenerator.centroid(d);
             const dist = Math.sqrt(x*x + y*y);
             // Pull pieces back together if healing
             const currentDisplacement = displacement * (1 - healingProgressRef.current);
             
             const moveX = (x / dist) * currentDisplacement;
             const moveY = (y / dist) * currentDisplacement;
             const shardJitter = (Math.sin(i * 132.1) * (100 - visualBodyState) * 0.1); 
             return `translate(${moveX + shardJitter + jitterX}, ${moveY + shardJitter + jitterY})`;
           }
           return `translate(${jitterX}, ${jitterY})`;
        });

      // --- Inner Core ---
      if (state.valence > 5 || isHealing) {
          group.append("circle")
              .attr("r", radius * 0.9)
              .attr("fill", color)
              .attr("opacity", isHealing ? 0.4 + (breathCycle * 0.3) : 0.6 + (state.valence / 250));
      }

      // --- Text Update (Inhale / Exhale) ---
      if (isHealing) {
        const cycleSeconds = timeRef.current % 8;
        const isInhale = cycleSeconds < 4;
        const textOpacity = Math.sin((timeRef.current % 4) / 4 * Math.PI); // Pulse opacity
        
        svg.select(".breath-text text")
           .text(isInhale ? "INHALE..." : "EXHALE...")
           .style("opacity", textOpacity * 0.8) // Max opacity 0.8
           .style("font-weight", "bold");
      } else {
        svg.select(".breath-text text")
           .style("opacity", 0);
      }

    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };

  }, [state, isHealing, isPulsing]);

  return (
    <svg 
      ref={svgRef} 
      viewBox={`0 0 ${size} ${size}`}
      className="w-full h-auto max-w-[350px] mx-auto transition-all duration-300 overflow-visible" 
    />
  );
};

export default OrbCanvas;