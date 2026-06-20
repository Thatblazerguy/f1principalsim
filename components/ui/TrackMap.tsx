import React, { useRef, useState, useEffect } from 'react';
import { getTrackPath } from '../../data/realTrackLayouts.js';
import { HUB } from '../HubLayout.tsx';

const TIRE_COLORS = {
  "Soft": "#ef4444",
  "Medium": "#facc15",
  "Hard": "#ffffff",
  "Intermediate": "#22c55e",
  "Wet": "#3b82f6"
};

export function TrackMap({ cars, trackName }) {
  const pathRef = useRef(null);
  const [pathLength, setPathLength] = useState(0);
  
  // Refs for direct DOM manipulation to achieve 60fps
  const carsRef = useRef([]);
  const visualCarsRef = useRef(new Map());
  const domRefs = useRef({});
  const glowRefs = useRef({});
  const drsRefs = useRef({});
  const labelRefs = useRef({});

  const d = getTrackPath(trackName);

  // Keep cars ref updated without triggering TrackMap re-renders inside the animation loop
  useEffect(() => {
    carsRef.current = cars;
  }, [cars]);

  // Wait for path to mount and get length
  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, [d]);

  // 60fps rendering loop
  useEffect(() => {
    let animationFrameId;
    let lastTime = performance.now();

    const loop = (time) => {
      const deltaMs = time - lastTime;
      lastTime = time;
      
      const len = pathRef.current ? pathRef.current.getTotalLength() : 0;

      if (len > 0 && carsRef.current) {
        const visualState = [];

        // Extrapolate positions
        carsRef.current.forEach(car => {
          let vCar = visualCarsRef.current.get(car.id);
          if (!vCar) {
            vCar = { distance: car.distance };
            visualCarsRef.current.set(car.id, vCar);
          }

          if (car.retired) {
             vCar.distance = car.distance;
          } else {
             const diff = car.distance - vCar.distance;
             if (Math.abs(diff) > 0.5) {
                // Snap if distance jumps wildly (e.g. skipping to finish)
                vCar.distance = car.distance;
             } else {
                // Smooth spring interpolation (0.15 smoothing factor at 60fps is crisp but smooth)
                vCar.distance += diff * 0.15;
             }
          }
          
          visualState.push({ id: car.id, vDistance: vCar.distance, car });
        });

        // Sort by distance to calculate gaps for DRS/Battles and identify the leader
        visualState.sort((a,b) => b.vDistance - a.vDistance);

        for (let i = 0; i < visualState.length; i++) {
           const vs = visualState[i];
           const car = vs.car;
           
           let inBattle = false;
           // If car is not leading, not retired, not pitting, check gap to car ahead
           if (i > 0 && !car.retired && !car.pitStopStatus.includes("Pit") && car.lap > 1) {
              const carAhead = visualState[i-1];
              const distGap = carAhead.vDistance - vs.vDistance;
              // < 0.012 laps is roughly a ~1.0s gap depending on track
              if (distGap < 0.012 && distGap > 0) {
                 inBattle = true;
              }
           }

           // Update DOM
           const domGroup = domRefs.current[car.id];
           if (domGroup) {
              domGroup.style.opacity = car.retired ? '0.3' : '1';

              let point;
              let lapFraction = vs.vDistance % 1;
              if (lapFraction < 0) lapFraction = 0;

              if (car.pitStopStatus === "Pitting" || car.pitStopStatus === "InLap") {
                 const basePoint = pathRef.current.getPointAtLength(0);
                 point = { x: basePoint.x + 10, y: basePoint.y + 10 };
              } else {
                 point = pathRef.current.getPointAtLength(len * lapFraction);
              }

              // Apply 60fps transform
              domGroup.setAttribute('transform', `translate(${point.x}, ${point.y})`);

              // Apply Battle Glow
              const glow = glowRefs.current[car.id];
              if (glow) {
                 if (inBattle) {
                    glow.setAttribute('opacity', '0.6');
                    glow.setAttribute('r', '8');
                    glow.setAttribute('fill', HUB.accent);
                 } else {
                    glow.setAttribute('opacity', '0');
                    glow.setAttribute('r', '3');
                 }
              }

              // Apply DRS Indicator
              const drs = drsRefs.current[car.id];
              if (drs) {
                 if (inBattle && car.lap >= 3 && car.tireCompound !== "Wet" && car.tireCompound !== "Intermediate") {
                    drs.setAttribute('opacity', '1');
                 } else {
                    drs.setAttribute('opacity', '0');
                 }
              }

              // Apply Label Visibility
              const label = labelRefs.current[car.id];
              if (label) {
                 if (car.isPlayer || i === 0 || inBattle) {
                    label.style.display = 'block';
                 } else {
                    label.style.display = 'none';
                 }
              }
           }
        }
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {/* Zoomed out viewBox to fit SVG paths properly */}
      <svg viewBox="-50 -50 600 600" style={{ width: '100%', height: '100%', margin: 'auto', opacity: 0.8 }}>
        
        {/* Track Base */}
        <path
          ref={pathRef}
          d={d}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={d}
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Sector Markers & Start/Finish */}
        {pathLength > 0 && (
          <>
            {/* Start / Finish line */}
            {(() => {
              const pt = pathRef.current.getPointAtLength(0);
              return <circle cx={pt.x} cy={pt.y} r="8" fill="#fff" stroke="#000" strokeWidth="2" />;
            })()}
            {/* Sector 1 End (33%) */}
            {(() => {
              const pt = pathRef.current.getPointAtLength(pathLength * 0.33);
              return <circle cx={pt.x} cy={pt.y} r="5" fill="#facc15" stroke="#000" strokeWidth="1" />;
            })()}
            {/* Sector 2 End (66%) */}
            {(() => {
              const pt = pathRef.current.getPointAtLength(pathLength * 0.66);
              return <circle cx={pt.x} cy={pt.y} r="5" fill="#facc15" stroke="#000" strokeWidth="1" />;
            })()}
          </>
        )}

        {/* Cars (Rendered once, positioned via refs) */}
        {cars && cars.map((car) => {
          const isPlayer = car.isPlayer;

          return (
            <g key={car.id} ref={el => domRefs.current[car.id] = el} style={{ willChange: 'transform' }}>
              
              {/* Proximity Battle Glow */}
              <circle 
                ref={el => glowRefs.current[car.id] = el} 
                r="3" 
                fill="transparent" 
                opacity="0" 
                style={{ transition: 'all 0.3s ease' }} 
              />
              
              {/* Outer ring for tire compound */}
              <circle r="4" fill={TIRE_COLORS[car.tireCompound]} opacity={isPlayer ? 1 : 0.8} />
              
              {/* Inner dot */}
              <circle r="2.5" fill={isPlayer ? HUB.accent : "#111"} />
              
              {/* DRS Indicator */}
              <rect 
                ref={el => drsRefs.current[car.id] = el}
                x="-4" y="-8" width="8" height="2" 
                fill="#22c55e" 
                rx="1"
                opacity="0"
                style={{ transition: 'opacity 0.2s ease' }}
              />

              {/* Label */}
              <text 
                ref={el => labelRefs.current[car.id] = el}
                x="8" y="3" 
                fill={isPlayer ? "#fff" : "rgba(255,255,255,0.7)"} 
                fontSize="7px" 
                fontWeight="bold" 
                fontFamily={HUB.fontMono}
                style={{ display: isPlayer ? 'block' : 'none' }}
              >
                {car.driver.name.substring(0,3).toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
