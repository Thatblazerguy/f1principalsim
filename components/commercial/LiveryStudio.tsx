import React, { Suspense, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { zoomSafeEvents } from '../zoomSafeEvents';
import { Environment, Lightformer, OrbitControls, Text, ContactShadows, Html } from '@react-three/drei';
import { ProceduralCar } from '../../screens/landing/Car';
import { useCanvasResizeNudge } from '../useCanvasResizeNudge';
import { ZONE_LABELS, ZONE_SLOT, slotLabel } from '../../utils/commercialModel.js';
import boldFont from '../../assets/fonts/Formula1-Bold_web_0.ttf?url';

/*
 * The team's car with each sponsor contract painted where it runs.
 * Hover a zone to light it, click to open that placement. A previewed
 * offer appears in red on its zone before anything is signed.
 */

type V3 = [number, number, number];
import { VIEWS, type CamView } from './studioViews.ts';
export { VIEWS, type CamView };

type Decal = { pos: V3; rot: V3; size: number; width: number; tilt?: number };
const DECALS: Record<string, Decal[]> = {
  engineCover: [{ pos: [-1.0, 0.72, 0.325], rot: [0, 0, 0], size: 0.1, width: 1.0 }, { pos: [-1.0, 0.72, -0.325], rot: [0, Math.PI, 0], size: 0.1, width: 1.0 }],
  nose: [{ pos: [2.0, 0.405, 0], rot: [-Math.PI / 2, 0, 0], size: 0.085, width: 0.7, tilt: -0.16 }],
  endplates: [{ pos: [-2.58, 0.72, 0.555], rot: [0, 0, 0], size: 0.075, width: 0.62 }, { pos: [-2.58, 0.72, -0.555], rot: [0, Math.PI, 0], size: 0.075, width: 0.62 }],
  sidepods: [{ pos: [-0.35, 0.42, 0.715], rot: [0, 0, 0], size: 0.11, width: 1.1 }, { pos: [-0.35, 0.42, -0.715], rot: [0, Math.PI, 0], size: 0.11, width: 1.1 }],
  rearWing: [{ pos: [-2.62, 1.03, 0], rot: [-Math.PI / 2, 0, -Math.PI / 2], size: 0.1, width: 0.95, tilt: 0.12 }, { pos: [-2.6, 1.106, 0], rot: [-Math.PI / 2, 0, -Math.PI / 2], size: 0.09, width: 0.95, tilt: 0.42 }],
  halo: [{ pos: [0.04, 0.905, 0], rot: [-Math.PI / 2, 0, 0], size: 0.05, width: 0.5 }],
};
const HITS: Record<string, { pos: V3; size: V3 }[]> = {
  engineCover: [{ pos: [-1.05, 0.72, 0], size: [1.6, 0.42, 0.7] }],
  nose: [{ pos: [2.0, 0.33, 0], size: [1.0, 0.22, 0.56] }],
  endplates: [{ pos: [-2.56, 0.75, 0.53], size: [0.9, 0.92, 0.06] }, { pos: [-2.56, 0.75, -0.53], size: [0.9, 0.92, 0.06] }],
  sidepods: [{ pos: [-0.45, 0.4, 0.62], size: [1.9, 0.46, 0.2] }, { pos: [-0.45, 0.4, -0.62], size: [1.9, 0.46, 0.2] }],
  rearWing: [{ pos: [-2.6, 1.03, 0], size: [0.62, 0.16, 1.04] }],
  halo: [{ pos: [0.04, 0.88, 0], size: [0.8, 0.14, 0.72] }],
  frontWing: [{ pos: [2.82, 0.15, 0], size: [0.55, 0.2, 1.95] }],
};

function CameraRig({ view, controls, reduced, flying }: { view: CamView; controls: React.RefObject<any>; reduced: boolean; flying: React.MutableRefObject<boolean> }) {
  const { camera } = useThree();
  const goal = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3() }), []);
  const last = useRef<CamView | null>(null);
  useFrame((_, dt) => {
    if (last.current !== view) { last.current = view; goal.pos.set(...VIEWS[view].pos); goal.look.set(...VIEWS[view].look); flying.current = true; }
    if (!flying.current || !controls.current) return;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 3.4);
    camera.position.lerp(goal.pos, k);
    controls.current.target.lerp(goal.look, k);
    controls.current.update();
    if (camera.position.distanceTo(goal.pos) < 0.02) flying.current = false;
  });
  return null;
}

function Wordmark({ text, d, preview }: { text: string; d: Decal; preview: boolean }) {
  const mat = useRef<any>(null);
  useFrame(({ clock }) => { if (preview && mat.current) mat.current.opacity = 0.65 + Math.sin(clock.elapsedTime * 3) * 0.3; });
  const inner = (
    <Text font={boldFont} fontSize={d.size} maxWidth={d.width} anchorX="center" anchorY="middle" textAlign="center" letterSpacing={0.02}
      rotation={d.rot} position={d.tilt === undefined ? d.pos : [0, 0, 0]} renderOrder={2} depthOffset={-1}>
      {text.toUpperCase()}
      <meshBasicMaterial ref={mat} attach="material" color={preview ? '#ff4d47' : '#f2f2f2'} transparent toneMapped={false} polygonOffset polygonOffsetFactor={-2} />
    </Text>
  );
  return d.tilt === undefined ? inner : <group position={d.pos} rotation={[0, 0, d.tilt]}>{inner}</group>;
}

function Zone({ id, hot, selected, assigned, onHover, onSelect }: { id: string; hot: boolean; selected: boolean; assigned: boolean; onHover: (z: string | null) => void; onSelect: (z: string) => void }) {
  const boxes = HITS[id];
  const on = hot || selected;
  return (
    <group>
      {boxes.map((b, i) => (
        <mesh key={i} position={b.pos}
          onPointerOver={(e) => { e.stopPropagation(); onHover(id); document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { onHover(null); document.body.style.cursor = ''; }}
          onClick={(e) => { e.stopPropagation(); onSelect(id); }}>
          <boxGeometry args={b.size} />
          <meshBasicMaterial color={selected ? '#E10600' : assigned ? '#ededed' : '#E10600'} transparent opacity={on ? (selected ? 0.18 : 0.1) : 0} depthWrite={false} />
        </mesh>
      ))}
      {on && boxes.map((b, i) => (
        <lineSegments key={`e${i}`} position={b.pos}>
          <edgesGeometry args={[new THREE.BoxGeometry(...b.size)]} />
          <lineBasicMaterial color={selected ? '#ff4d47' : '#ededed'} transparent opacity={selected ? 0.9 : 0.5} />
        </lineSegments>
      ))}
    </group>
  );
}

export default function LiveryStudio({ contracts, preview, selectedZone, onSelectZone, view, reduced, mobile }: {
  contracts: Record<string, any>; preview: { slotKey: string; name: string } | null;
  selectedZone: string | null; onSelectZone: (z: string | null) => void; view: CamView; reduced: boolean; mobile: boolean;
}) {
  const controls = useRef<any>(null);
  const flying = useRef(false);
  const [hot, setHot] = useState<string | null>(null);
  useCanvasResizeNudge();

  const nameFor = (zone: string) => {
    const slot = ZONE_SLOT[zone];
    if (!slot) return null;
    if (preview?.slotKey === slot) return { text: preview.name, preview: true };
    const c = contracts[slot];
    return c ? { text: c.name, preview: false } : null;
  };
  const hotInfo = hot ? (() => {
    const slot = ZONE_SLOT[hot];
    const n = nameFor(hot);
    return { label: ZONE_LABELS[hot], sub: !slot ? 'Not a contract slot in this game' : n ? `${slotLabel(slot)} · ${n.text}${n.preview ? ' (preview)' : ''}` : `${slotLabel(slot)} placement · vacant` };
  })() : null;

  return (
    <Canvas
      events={zoomSafeEvents}
      resize={{ offsetSize: true }}
      dpr={mobile ? 1.25 : [1, 1.75]}
      camera={{ position: VIEWS.three.pos, fov: 32, near: 0.1, far: 100 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onPointerMissed={() => onSelectZone(null)}
      style={{ position: 'absolute', inset: 0 }}
    >
      <color attach="background" args={['#070708']} />
      <fog attach="fog" args={['#070708', 12, 30]} />
      <ambientLight intensity={0.25} />
      <spotLight position={[2, 9, 4]} angle={0.5} penumbra={0.9} intensity={70} color="#fff6ee" />
      <spotLight position={[-6, 3, -5]} angle={0.5} penumbra={1} intensity={40} color="#dfe6ff" />
      <Suspense fallback={null}>
        <ProceduralCar compound="medium" />
        {Object.keys(DECALS).map(zone => {
          const n = nameFor(zone);
          return n ? DECALS[zone].map((d, i) => <Wordmark key={`${zone}${i}${n.text}`} text={n.text} d={d} preview={n.preview && !reduced} />) : null;
        })}
      </Suspense>
      {Object.keys(HITS).map(zone => (
        <Zone key={zone} id={zone} hot={hot === zone} selected={selectedZone === zone} assigned={!!nameFor(zone)} onHover={setHot} onSelect={(z) => onSelectZone(z)} />
      ))}
      {hotInfo && hot && (
        <Html position={HITS[hot][0].pos} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <div className="cm-tip"><strong>{hotInfo.label}</strong><span>{hotInfo.sub}</span></div>
        </Html>
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#0a0a0b" roughness={0.55} metalness={0.3} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
        <ringGeometry args={[3.6, 3.63, 96]} />
        <meshBasicMaterial color="#E10600" transparent opacity={0.5} toneMapped={false} />
      </mesh>
      <ContactShadows position={[0, 0.005, 0]} opacity={0.7} scale={10} blur={2.2} far={2} />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={3} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[10, 2, 1]} />
        <Lightformer form="rect" intensity={1.4} position={[-6, 2, 0]} rotation-y={Math.PI / 2} scale={[8, 1, 1]} />
        <Lightformer form="rect" intensity={1.4} position={[6, 2, 0]} rotation-y={-Math.PI / 2} scale={[8, 1, 1]} />
        <Lightformer form="rect" intensity={0.6} color="#E10600" position={[0, 1, -8]} scale={[6, 0.4, 1]} />
      </Environment>
      <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping dampingFactor={0.08} minDistance={2.4} maxDistance={14}
        maxPolarAngle={Math.PI / 2 - 0.03} autoRotate={!reduced && !selectedZone && !hot && view === 'three'} autoRotateSpeed={0.3}
        onStart={() => { flying.current = false; }} />
      <CameraRig view={view} controls={controls} reduced={reduced} flying={flying} />
    </Canvas>
  );
}
