import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, MeshReflectorMaterial, OrbitControls, Html, ContactShadows } from '@react-three/drei';
import { ProceduralCar, type CarPart } from '../../screens/landing/Car';
import { GARAGE_PARTS, OVERVIEW_CAM } from './garageParts';
import { useCanvasResizeNudge } from '../useCanvasResizeNudge';
import { zoomSafeEvents } from '../zoomSafeEvents';

/*
 * The team's car in the garage. Drag to orbit, click a hotspot to fly the camera
 * to that part. Parts with an introduced upgrade switch to the red-tinted spec.
 */

const ACCENT = '#E10600';

function CameraFocus({ selected, controls, reduced, flying }: { selected: CarPart | null; controls: React.RefObject<any>; reduced: boolean; flying: React.MutableRefObject<boolean> }) {
  const { camera } = useThree();
  const goal = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3() }), []);
  const last = useRef<CarPart | null | undefined>(undefined);
  useFrame((_, dt) => {
    if (last.current !== selected) {
      last.current = selected;
      const p = GARAGE_PARTS.find(x => x.id === selected);
      goal.pos.set(...(p ? p.cam : OVERVIEW_CAM.cam));
      goal.look.set(...(p ? p.look : OVERVIEW_CAM.look));
      flying.current = true;
    }
    if (!flying.current || !controls.current) return;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 3.2);
    camera.position.lerp(goal.pos, k);
    controls.current.target.lerp(goal.look, k);
    controls.current.update();
    if (camera.position.distanceTo(goal.pos) < 0.02) flying.current = false;
  });
  return null;
}

function SpotOnPart({ selected }: { selected: CarPart | null }) {
  const light = useRef<THREE.SpotLight>(null!);
  const target = useMemo(() => new THREE.Object3D(), []);
  const goal = useMemo(() => new THREE.Vector3(0, 0.4, 0), []);
  useFrame((_, dt) => {
    const p = GARAGE_PARTS.find(x => x.id === selected);
    goal.set(...(p ? p.anchor : ([0, 0.4, 0] as [number, number, number])));
    target.position.lerp(goal, 1 - Math.exp(-dt * 4));
    light.current.intensity = THREE.MathUtils.lerp(light.current.intensity, p ? 70 : 0, 1 - Math.exp(-dt * 4));
  });
  return (
    <>
      <primitive object={target} />
      <spotLight ref={light} position={[0, 6, 2]} angle={0.22} penumbra={0.8} intensity={0} color="#fff3ea" target={target} />
    </>
  );
}

function Hotspots({ selected, upgraded, active, onSelect }: { selected: CarPart | null; upgraded: Partial<Record<CarPart, boolean>>; active: Partial<Record<CarPart, number>>; onSelect: (id: CarPart) => void }) {
  return (
    <>
      {GARAGE_PARTS.map(p => {
        const isSel = selected === p.id;
        return (
          <Html key={p.id} position={p.anchor} zIndexRange={[30, 10]} center>
            <button
              type="button"
              className={`gx-hot ${isSel ? 'is-selected' : ''} ${selected && !isSel ? 'is-dim' : ''}`}
              onClick={(e) => { e.stopPropagation(); onSelect(p.id); }}
              aria-pressed={isSel}
              aria-label={`${p.label}${upgraded[p.id] ? ', upgraded' : ''}${active[p.id] ? `, ${active[p.id]} project in development` : ''}`}
            >
              <span className="gx-hot-dot" data-upgraded={upgraded[p.id] ? 'true' : 'false'} />
              <span className="gx-hot-label">
                {p.label}
                {active[p.id] ? <em>In development</em> : upgraded[p.id] ? <em>Upgraded</em> : null}
              </span>
            </button>
          </Html>
        );
      })}
    </>
  );
}

export default function Garage3D({ selected, onSelect, upgraded, active, reduced, mobile }: {
  selected: CarPart | null; onSelect: (id: CarPart | null) => void;
  upgraded: Partial<Record<CarPart, boolean>>; active: Partial<Record<CarPart, number>>;
  reduced: boolean; mobile: boolean;
}) {
  const controls = useRef<any>(null);
  const flying = useRef(false);
  useCanvasResizeNudge();
  return (
    <Canvas
      events={zoomSafeEvents}
      resize={{ offsetSize: true }}
      shadows={!mobile}
      dpr={mobile ? 1.25 : [1, 1.75]}
      camera={{ position: OVERVIEW_CAM.cam, fov: 32, near: 0.1, far: 120 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onPointerMissed={() => onSelect(null)}
      style={{ position: 'absolute', inset: 0 }}
    >
      <color attach="background" args={['#070708']} />
      <fog attach="fog" args={['#070708', 12, 34]} />
      <ambientLight intensity={0.16} />
      <spotLight position={[2.5, 9, 3]} angle={0.45} penumbra={0.9} intensity={80} color="#fff6ee" castShadow={!mobile} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
      <spotLight position={[-6, 3, -6]} angle={0.5} penumbra={1} intensity={45} color="#dfe6ff" />
      <SpotOnPart selected={selected} />

      <ProceduralCar compound="soft" upgraded={upgraded} />
      <Hotspots selected={selected} upgraded={upgraded} active={active} onSelect={(id) => onSelect(selected === id ? null : id)} />

      {/* garage floor with the team's red line through the bay */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        {mobile
          ? <meshStandardMaterial color="#0b0b0c" roughness={0.6} metalness={0.2} />
          : <MeshReflectorMaterial resolution={512} blur={[300, 80]} mixBlur={1} mixStrength={30} roughness={0.9} depthScale={1.1} minDepthThreshold={0.4} maxDepthThreshold={1.4} color="#0b0b0c" metalness={0.6} mirror={0.5} />}
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 1.6]}>
        <planeGeometry args={[9, 0.04]} />
        <meshBasicMaterial color={ACCENT} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, -1.6]}>
        <planeGeometry args={[9, 0.04]} />
        <meshBasicMaterial color="#3a3a3e" />
      </mesh>
      {mobile && <ContactShadows position={[0, 0.005, 0]} opacity={0.6} scale={10} blur={2.4} far={2} />}

      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={3} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[10, 2, 1]} />
        <Lightformer form="rect" intensity={1.6} position={[-6, 2, 0]} rotation-y={Math.PI / 2} scale={[8, 1, 1]} />
        <Lightformer form="rect" intensity={1.6} position={[6, 2, 0]} rotation-y={-Math.PI / 2} scale={[8, 1, 1]} />
        <Lightformer form="rect" intensity={0.6} color={ACCENT} position={[0, 1, -8]} scale={[6, 0.4, 1]} />
      </Environment>

      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={2.2}
        maxDistance={13}
        minPolarAngle={0.25}
        maxPolarAngle={Math.PI / 2 - 0.04}
        autoRotate={!reduced && !selected}
        autoRotateSpeed={0.35}
        onStart={() => { flying.current = false; }}
      />
      <CameraFocus selected={selected} controls={controls} reduced={reduced} flying={flying} />
    </Canvas>
  );
}

