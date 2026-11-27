import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, MeshReflectorMaterial, Html, Text, Sparkles, Line, useGLTF, PerformanceMonitor } from '@react-three/drei';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { ProceduralCar, ANCHORS } from './Car';
import { story, smooth, window01, lerp, local, ACCENT, TYRE, CAR_MODEL_URL } from './story';
import { getTrackPath } from '../../data/realTrackLayouts.js';
import wideFont from '../../Formula1-Wide_web_0.ttf?url';

/* ─────────────────────────────────────────────────────────────────────────────
 * Camera path. Each key is a story position t (section index + progress).
 * Between keys the camera eases, so scrolling drives one continuous shot.
 * ────────────────────────────────────────────────────────────────────────── */
type V3 = [number, number, number];
type Key = { t: number; pos: V3; look: V3; fov: number };
const KEYS: Key[] = [
  { t: 0.00, pos: [6.6, 1.75, 8.2], look: [-0.4, 0.45, 0], fov: 30 },
  { t: 0.50, pos: [8.6, 0.95, 2.6], look: [0, 0.5, 0], fov: 28 },
  { t: 0.92, pos: [9.6, 0.62, 0.0], look: [0, 0.48, 0], fov: 25 },
  // Engineering: front wing → suspension → tyres → power unit → rear wing → airflow
  { t: 1.08, pos: [4.5, 0.5, 1.7], look: [2.8, 0.18, 0.25], fov: 32 },
  { t: 1.24, pos: [3.0, 0.75, 2.5], look: [1.7, 0.38, 0.7], fov: 34 },
  { t: 1.40, pos: [-0.5, 0.6, 2.8], look: [-1.76, 0.38, 0.85], fov: 34 },
  { t: 1.56, pos: [-0.2, 2.5, 1.8], look: [-0.9, 0.62, 0], fov: 38 },
  { t: 1.72, pos: [-5.9, 1.9, 3.0], look: [-2.4, 0.8, 0], fov: 34 },
  { t: 1.90, pos: [3.2, 3.4, 5.6], look: [0, 0.45, 0], fov: 34 },
  // Team: pull back into the garage, drift past the panels
  { t: 2.10, pos: [1.2, 2.6, 11.5], look: [0, 1.5, -1.6], fov: 40 },
  { t: 2.60, pos: [-2.6, 2.3, 10.5], look: [0.6, 1.5, -1.8], fov: 40 },
  { t: 2.90, pos: [-1.2, 7.0, 8.0], look: [0, 0.4, 0], fov: 40 },
  // Strategy: top-down over the circuit (look target is replaced by the track centre)
  { t: 3.12, pos: [3.5, 34, 6], look: [3.5, 0, 0.5], fov: 40 },
  { t: 3.92, pos: [3.0, 32, 5], look: [3.0, 0, 0.5], fov: 40 },
  // Race weekend: low behind the car on the grid, up to the lights, then chase the launch
  { t: 4.10, pos: [-10.5, 1.5, 3.4], look: [3, 0.9, 0], fov: 34 },
  { t: 4.50, pos: [-9.0, 1.1, 2.4], look: [7, 2.6, 0], fov: 32 },
  { t: 4.74, pos: [-8.0, 0.9, 2.0], look: [4, 0.7, 0], fov: 30 },
  { t: 4.98, pos: [-6.5, 0.7, 1.6], look: [4, 0.5, 0], fov: 38 },
  // Legacy: sunset, car back in the hero pose from the other side
  { t: 5.02, pos: [7.4, 0.9, -6.2], look: [0, 1.45, 0], fov: 30 },
  { t: 6.00, pos: [6.2, 0.8, -5.0], look: [0, 1.5, 0], fov: 28 },
];

function sampleKeys(t: number) {
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const u = smooth((t - a.t) / Math.max(1e-4, b.t - a.t));
  return {
    pos: a.pos.map((v, k) => lerp(v, b.pos[k], u)) as V3,
    look: a.look.map((v, k) => lerp(v, b.look[k], u)) as V3,
    fov: lerp(a.fov, b.fov, u),
  };
}

/* ── Circuit (from the game's own track data) ─────────────────────────────── */
function useCircuit(name: string, size = 20) {
  return useMemo(() => {
    const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${getTrackPath(name)}"/></svg>`);
    const raw = data.paths[0].subPaths[0].getSpacedPoints(600);
    const box = new THREE.Box2().setFromPoints(raw);
    const c = box.getCenter(new THREE.Vector2());
    const s = size / Math.max(box.max.x - box.min.x, box.max.y - box.min.y);
    const pts = raw.map(p => new THREE.Vector3((p.x - c.x) * s, 0.02, (p.y - c.y) * s));
    const curve = new THREE.CatmullRomCurve3(pts, true);
    return { pts, curve };
  }, [name, size]);
}

/* ── Sky dome: night studio that warms into sunset ───────────────────────── */
function Sky() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { warm: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform float warm; varying vec3 vP;
      void main(){
        float h = clamp(vP.y * 0.5 + 0.5, 0., 1.);
        vec3 night = mix(vec3(0.022,0.022,0.026), vec3(0.008,0.008,0.01), smoothstep(0.45, 1., h));
        vec3 horizon = vec3(0.34,0.1,0.035);
        vec3 dusk = mix(horizon, vec3(0.03,0.025,0.035), smoothstep(0.49, 0.62, h));
        dusk = mix(vec3(0.02,0.012,0.01), dusk, smoothstep(0.42, 0.5, h));
        gl_FragColor = vec4(mix(night, dusk, warm), 1.);
      }`,
  }), []);
  useFrame(() => { mat.uniforms.warm.value = smooth((story.t - 4.98) / 0.25); });
  return <mesh material={mat} scale={120}><sphereGeometry args={[1, 32, 16]} /></mesh>;
}

/* ── The car, wherever the story needs it ─────────────────────────────────── */
function GLBCar({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

function CarRig({ circuit }: { circuit: ReturnType<typeof useCircuit> }) {
  const group = useRef<THREE.Group>(null!);
  const drs = useRef<THREE.Group>(null);
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), tan: new THREE.Vector3() }), []);
  useFrame((_, dt) => {
    const t = story.t;
    const g = group.current;
    // Strategy: shrink onto the circuit and lap it
    const toTrack = smooth((t - 2.92) / 0.2) * (1 - smooth((t - 3.95) / 0.12));
    const lap = (local(3) * 1.15) % 1;
    circuit.curve.getPointAt(lap, tmp.p);
    circuit.curve.getTangentAt(lap, tmp.tan);
    const trackYaw = Math.atan2(-tmp.tan.z, tmp.tan.x);
    // Race: launch after lights out
    const launch = t > 4 && t < 5 ? Math.pow(smooth((t - 4.72) / 0.26), 2.2) : 0;
    // Hero: mouse rotation; legacy: slow turntable
    const heroW = 1 - smooth((t - 0.35) / 0.4);
    const mouseYaw = story.reduced ? 0 : story.mouse.x * 0.35 * heroW;
    const baseYaw = t < 4.99 ? 0 : lerp(0, -0.25, smooth(local(5)));
    const yaw = lerp(baseYaw + mouseYaw, trackYaw, toTrack);
    const scale = lerp(1, 0.3, toTrack);
    const x = lerp(launch * 46, tmp.p.x, toTrack);
    const z = lerp(0, tmp.p.z, toTrack);
    const k = 1 - Math.exp(-dt * 6);
    g.position.x = lerp(g.position.x, x, toTrack > 0.01 && toTrack < 0.99 ? k : 1);
    g.position.z = lerp(g.position.z, z, toTrack > 0.01 && toTrack < 0.99 ? k : 1);
    g.rotation.y = lerp(g.rotation.y, yaw, k);
    g.scale.setScalar(scale);
    // DRS opens while the rear wing is on screen and on the straight in the launch
    const open = Math.max(window01(t, 1.66, 1.82, 0.04), launch > 0.3 ? 1 : 0);
    if (drs.current) drs.current.rotation.z = lerp(drs.current.rotation.z, -open * 0.55, k);
  });
  return (
    <group ref={group}>
      {CAR_MODEL_URL ? <Suspense fallback={null}><GLBCar url={CAR_MODEL_URL} /></Suspense> : <ProceduralCar drsRef={drs} compound="soft" />}
      <Annotations />
      <Airflow />
      <TrackMarker />
    </group>
  );
}

function TrackMarker() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    const o = window01(story.t, 3.12, 3.9, 0.08);
    ref.current.visible = o > 0.01;
    (ref.current.material as THREE.MeshBasicMaterial).opacity = o;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
      <ringGeometry args={[3.2, 3.8, 48]} />
      <meshBasicMaterial color={ACCENT} transparent opacity={0} toneMapped={false} />
    </mesh>
  );
}

/* ── Engineering annotations (what each part means in the game) ──────────── */
const NOTES: { id: keyof typeof ANCHORS; at: number; title: string; body: string; figure: string }[] = [
  { id: 'frontWing', at: 1.08, title: 'Front wing', body: 'Aero upgrades move your downforce rating and how the car turns in', figure: 'Aero' },
  { id: 'suspension', at: 1.24, title: 'Suspension', body: 'Chassis development decides grip over kerbs and through slow corners', figure: 'Chassis' },
  { id: 'tyres', at: 1.40, title: 'Tyres', body: 'Soft, medium and hard. Wear is modelled lap by lap', figure: 'Compounds' },
  { id: 'powerUnit', at: 1.56, title: 'Power unit', body: 'Push for performance or protect reliability across the season', figure: 'Reliability' },
  { id: 'rearWing', at: 1.72, title: 'Rear wing and DRS', body: 'Trade top speed against cornering load, circuit by circuit', figure: 'DRS open' },
  { id: 'airflow', at: 1.90, title: 'Airflow', body: 'Split wind tunnel and CFD time between this car and the next', figure: 'CFD' },
];

function Annotations() {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useFrame(() => {
    NOTES.forEach((n, i) => {
      const el = refs.current[i];
      if (!el) return;
      const o = window01(story.t, n.at - 0.04, n.at + 0.08, 0.035);
      el.style.opacity = String(o);
      el.style.transform = `translate3d(0, ${(1 - o) * 8}px, 0)`;
      el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
    });
  });
  return (
    <>
      {NOTES.map((n, i) => (
        <Html key={n.id} position={ANCHORS[n.id]} zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <div ref={el => { refs.current[i] = el; }} className="lx-note" style={{ opacity: 0, visibility: 'hidden' }}>
            <span className="lx-note-dot" />
            <span className="lx-note-line" />
            <div className="lx-note-card">
              <div className="lx-note-head"><span>{n.title}</span><span className="lx-note-fig">{n.figure}</span></div>
              <p>{n.body}</p>
            </div>
          </div>
        </Html>
      ))}
    </>
  );
}

/* ── Airflow: streamlines over the car, dashes flow with time ─────────────── */
function Airflow() {
  const lines = useMemo(() => {
    const out: THREE.Vector3[][] = [];
    for (let i = 0; i < 9; i++) {
      const z = (i - 4) * 0.2;
      const lift = 1 - Math.abs(z) * 0.9;
      const c = new THREE.CatmullRomCurve3([
        new THREE.Vector3(4.6, 0.3 + lift * 0.1, z * 1.3),
        new THREE.Vector3(2.9, 0.35, z * 1.2),
        new THREE.Vector3(1.4, 0.62 + lift * 0.12, z * 1.05),
        new THREE.Vector3(0.0, 1.02 * lift + 0.12, z * 0.9),
        new THREE.Vector3(-1.4, 0.95 * lift + 0.2, z * 0.95),
        new THREE.Vector3(-2.7, 1.32, z * 1.05),
        new THREE.Vector3(-4.4, 1.7 + (1 - lift) * 0.2, z * 1.25),
      ]);
      out.push(c.getPoints(80));
    }
    return out;
  }, []);
  const mats = useRef<any[]>([]);
  useFrame((_, dt) => {
    const o = window01(story.t, 1.84, 1.98, 0.05) * 0.85;
    mats.current.forEach(m => { if (!m) return; m.opacity = o; m.dashOffset -= dt * 1.6; m.visible = o > 0.01; });
  });
  return (
    <group>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color={i === 4 ? ACCENT : '#cfd3da'} lineWidth={i === 4 ? 1.6 : 1} dashed dashSize={0.35} gapSize={0.25}
          transparent opacity={0} ref={(l: any) => { mats.current[i] = l?.material; }} />
      ))}
    </group>
  );
}

/* ── Studio floor + light rig, mood driven by the story ───────────────────── */
function Studio({ mobile }: { mobile: boolean }) {
  const key = useRef<THREE.SpotLight>(null!);
  const rim = useRef<THREE.SpotLight>(null!);
  const sun = useRef<THREE.DirectionalLight>(null!);
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const t = story.t;
    const boot = smooth((t + 0.02) / 0.02); // lit once the experience starts
    const warm = smooth((t - 4.98) / 0.25);
    const reveal = smooth(t / 0.9); // rim sweeps in as the camera goes head-on
    key.current.intensity = lerp(90, 30, warm) * boot;
    rim.current.intensity = lerp(8, 70, reveal) * (1 - warm * 0.6);
    rim.current.position.z = lerp(-6, 0, reveal);
    sun.current.intensity = warm * 1.6;
  });
  return (
    <>
      <primitive object={target} position={[0, 0.3, 0]} />
      <ambientLight intensity={0.14} />
      <spotLight ref={key} position={[2.5, 9, 3]} angle={0.42} penumbra={0.9} intensity={60} color="#fff6ee" castShadow={!mobile}
        shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} target={target} />
      <spotLight ref={rim} position={[-6, 3, -6]} angle={0.5} penumbra={1} intensity={8} color="#dfe6ff" target={target} />
      <directionalLight ref={sun} position={[-30, 4, 18]} intensity={0} color="#ff8a3d" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        {mobile ? (
          <meshStandardMaterial color="#09090a" roughness={0.6} metalness={0.2} />
        ) : (
          <MeshReflectorMaterial resolution={512} blur={[300, 80]} mixBlur={1} mixStrength={38} roughness={0.9} depthScale={1.1}
            minDepthThreshold={0.4} maxDepthThreshold={1.4} color="#0b0b0c" metalness={0.6} mirror={0.5} />
        )}
      </mesh>
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={3} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[10, 2, 1]} />
        <Lightformer form="rect" intensity={1.6} position={[-6, 2, 0]} rotation-y={Math.PI / 2} scale={[8, 1, 1]} />
        <Lightformer form="rect" intensity={1.6} position={[6, 2, 0]} rotation-y={-Math.PI / 2} scale={[8, 1, 1]} />
        <Lightformer form="rect" intensity={0.6} color={ACCENT} position={[0, 1, -8]} scale={[6, 0.4, 1]} />
      </Environment>
    </>
  );
}

/* ── Hero wordmark behind the car ─────────────────────────────────────────── */
function Wordmark() {
  const ref = useRef<any>(null);
  useFrame(() => {
    if (!ref.current) return;
    const o = 1 - smooth((story.t - 0.15) / 0.35);
    ref.current.fillOpacity = o;
    ref.current.visible = o > 0.01;
  });
  return (
    <Text ref={ref} font={wideFont} fontSize={3.6} position={[-0.8, 2.3, -7]} color="#2a2a2e" anchorX="center" anchorY="middle" letterSpacing={0.02}>
      F1P
    </Text>
  );
}

/* ── Garage set with the game's management screens as 3D panels ───────────── */
const PANELS: { title: string; meta: string; rows: [string, string][]; pos: V3; rotY: number }[] = [
  { title: 'Drivers', meta: '2 race seats · 1 reserve', rows: [['Charles Leclerc', 'OVR 91'], ['Lewis Hamilton', 'OVR 90'], ['Contract', '2 seasons']], pos: [-5.0, 2.40, -2.0], rotY: 0.55 },
  { title: 'Staff', meta: 'Senior hires', rows: [['Technical director', '83'], ['Head of aerodynamics', '82'], ['Race strategist', '79']], pos: [-2.5, 3.20, -3.3], rotY: 0.22 },
  { title: 'Finance', meta: 'Budget', rows: [['Available', '$84.0M'], ['Cost cap', '$145M'], ['Last race net', '+$3.6M']], pos: [0.3, 3.55, -3.7], rotY: 0 },
  { title: 'Research and development', meta: 'Projects', rows: [['Floor upgrade', 'Round 4'], ['Wind tunnel', '70% current car'], ['CFD', '30% next car']], pos: [3.1, 3.20, -3.3], rotY: -0.22 },
  { title: 'Facilities', meta: 'Factory', rows: [['Simulator', 'Level 2'], ['Wind tunnel', 'Level 3'], ['Academy', 'Level 1']], pos: [5.5, 2.40, -2.0], rotY: -0.55 },
  { title: 'Sponsors', meta: 'Commercial', rows: [['Title partner', 'Signed'], ['Rear wing slot', 'Open'], ['Race bonus', '$1.2M']], pos: [-2.0, 1.65, -4.6], rotY: 0.12 },
];

function Garage({ mobile }: { mobile: boolean }) {
  const set = useRef<THREE.Group>(null!);
  const strips = useRef<THREE.MeshStandardMaterial>(null!);
  const panelEls = useRef<(HTMLDivElement | null)[]>([]);
  useFrame(() => {
    const o = window01(story.t, 2.08, 2.85, 0.12);
    set.current.visible = o > 0.01;
    strips.current.emissiveIntensity = o * 2.2;
    panelEls.current.forEach((el, i) => {
      if (!el) return;
      const oi = smooth((story.t - 2.1 - i * 0.05) / 0.12) * (1 - smooth((story.t - 2.82) / 0.1));
      el.style.opacity = String(oi);
      el.style.transform = `translateY(${(1 - oi) * 24}px)`;
    });
  });
  return (
    <group ref={set}>
      {/* back wall + ceiling light bars + side bays */}
      <mesh position={[0, 3, -6]} receiveShadow>
        <planeGeometry args={[24, 6]} />
        <meshStandardMaterial color="#0d0d0f" roughness={0.8} />
      </mesh>
      {[-9, -6, -3, 0, 3, 6, 9].map(x => (
        <mesh key={x} position={[x, 3, -5.98]}>
          <planeGeometry args={[0.06, 5.2]} />
          <meshStandardMaterial ref={x === 0 ? strips : undefined} color="#111" emissive="#e9edf5" emissiveIntensity={0} />
        </mesh>
      ))}
      {[-4, 0, 4].map(x => (
        <mesh key={x} position={[x, 5.6, -1]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3, 0.12]} />
          <meshBasicMaterial color="#f3f4f7" />
        </mesh>
      ))}
      {/* tyre stacks on blankets — the only colour in the garage */}
      {[[-7, 'soft'], [-7.9, 'medium'], [7, 'hard']].map(([x, c]) => (
        <group key={x as number} position={[x as number, 0, -4.4]}>
          {[0, 1, 2, 3].map(i => (
            <mesh key={i} position={[0, 0.17 + i * 0.36, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <torusGeometry args={[0.3, 0.14, 12, 32]} />
              <meshStandardMaterial color={i === 3 ? TYRE[c as 'soft'] : '#141415'} roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}
      {!mobile && PANELS.map((p, i) => (
        <Html key={p.title} transform distanceFactor={4} position={p.pos} rotation={[0, p.rotY, 0]} zIndexRange={[15, 5]} style={{ pointerEvents: 'none' }}>
          <div ref={el => { panelEls.current[i] = el; }} className="lx-panel" style={{ opacity: 0 }}>
            <div className="lx-panel-head"><span>{p.title}</span><span>{p.meta}</span></div>
            {p.rows.map(([a, b]) => <div key={a} className="lx-panel-row"><span>{a}</span><span>{b}</span></div>)}
          </div>
        </Html>
      ))}
    </group>
  );
}

/* ── Strategy set: top-down circuit with racing line, sectors and pit lane ── */
function Strategy({ circuit }: { circuit: ReturnType<typeof useCircuit> }) {
  const set = useRef<THREE.Group>(null!);
  const mats = useRef<any[]>([]);
  const tags = useRef<(HTMLDivElement | null)[]>([]);
  const n = circuit.pts.length;
  const sectors = useMemo(() => [0, 1, 2].map(s => circuit.pts.slice(Math.floor((s * n) / 3), Math.floor(((s + 1) * n) / 3) + 1)), [circuit, n]);
  const pit = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = -40; i <= 20; i++) {
      const u = ((i / n) + 1) % 1;
      const p = circuit.curve.getPointAt(u), tan = circuit.curve.getTangentAt(u);
      const nrm = new THREE.Vector3(-tan.z, 0, tan.x).multiplyScalar(i > -34 && i < 14 ? 0.55 : 0.55 * (i <= -34 ? (i + 40) / 6 : (20 - i) / 6));
      pts.push(p.clone().add(nrm));
    }
    return pts;
  }, [circuit, n]);
  useFrame(() => {
    const o = window01(story.t, 3.08, 3.92, 0.1);
    set.current.visible = o > 0.01;
    mats.current.forEach(m => { if (m) m.opacity = o * (m.userData.base ?? 1); });
    tags.current.forEach(el => { if (el) { el.style.opacity = String(o); el.style.visibility = o > 0.01 ? 'visible' : 'hidden'; } });
    // current sector highlighted in the accent
    const lap = (local(3) * 1.15) % 1;
    const cur = Math.min(2, Math.floor(lap * 3));
    sectors.forEach((_, i) => { const m = mats.current[2 + i]; if (m) m.color.set(i === cur ? ACCENT : '#e7e8ec'); });
  });
  const reg = (i: number, base = 1) => (l: any) => { if (l?.material) { l.material.userData.base = base; mats.current[i] = l.material; } };
  return (
    <group ref={set}>
      <Line points={circuit.pts} color="#2a2a2e" lineWidth={22} transparent opacity={0} ref={reg(0)} />
      <Line points={pit} color="#7a7a80" lineWidth={2} dashed dashSize={0.25} gapSize={0.18} transparent opacity={0} ref={reg(1, 0.8)} />
      {sectors.map((pts, i) => <Line key={i} points={pts} color="#e7e8ec" lineWidth={2.2} transparent opacity={0} ref={reg(2 + i)} />)}
      <Html position={[circuit.pts[0].x, 0.2, circuit.pts[0].z]} center style={{ pointerEvents: 'none' }}>
        <div ref={el => { tags.current[0] = el; }} className="lx-track-tag" style={{ visibility: 'hidden' }}>Pit entry</div>
      </Html>
      <Html position={[circuit.pts[Math.floor(n / 3)].x, 0.2, circuit.pts[Math.floor(n / 3)].z]} center style={{ pointerEvents: 'none' }}>
        <div ref={el => { tags.current[1] = el; }} className="lx-track-tag" style={{ visibility: 'hidden' }}>Sector 2</div>
      </Html>
      <Html position={[circuit.pts[Math.floor((2 * n) / 3)].x, 0.2, circuit.pts[Math.floor((2 * n) / 3)].z]} center style={{ pointerEvents: 'none' }}>
        <div ref={el => { tags.current[2] = el; }} className="lx-track-tag" style={{ visibility: 'hidden' }}>Sector 3</div>
      </Html>
    </group>
  );
}

/* ── Race set: grid slots, start gantry, speed streaks ─────────────────────── */
function Race() {
  const set = useRef<THREE.Group>(null!);
  const lights = useRef<THREE.MeshStandardMaterial[]>([]);
  const streaks = useRef<THREE.InstancedMesh>(null!);
  const seeds = useMemo(() => Array.from({ length: 80 }, () => [Math.random() * 60, (Math.random() - 0.5) * 10, Math.random() * 2.4 + 0.05]), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const t = story.t;
    const o = window01(t, 4.04, 4.97, 0.05);
    set.current.visible = o > 0.01;
    const p = local(4);
    // five lights come on one by one, then all out
    const on = p < 0.7 ? Math.min(5, Math.floor(((p - 0.18) / 0.42) * 5) + 1) : 0;
    lights.current.forEach((m, i) => { if (m) m.emissiveIntensity = (Math.floor(i / 2) < on && p > 0.18 ? 9 : 0); });
    const launch = Math.pow(smooth((t - 4.72) / 0.26), 2.2);
    const carX = launch * 46;
    streaks.current.visible = launch > 0.02;
    seeds.forEach(([sx, sz, sy], i) => {
      const x = carX + 30 - ((sx + clock.elapsedTime * 60 * launch) % 60);
      dummy.position.set(x, sy, sz);
      dummy.scale.set(1.5 + launch * 5, 1, 1);
      dummy.updateMatrix();
      streaks.current.setMatrixAt(i, dummy.matrix);
    });
    streaks.current.instanceMatrix.needsUpdate = true;
    (streaks.current.material as THREE.MeshBasicMaterial).opacity = launch * 0.35;
  });
  return (
    <group ref={set}>
      {/* grid slots */}
      {[0, -8, -16].map(x => (
        <group key={x} position={[x + 3.1, 0.012, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.1, 2.4]} /><meshBasicMaterial color="#d9d9de" /></mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.4, 0, 1.15]}><planeGeometry args={[0.8, 0.1]} /><meshBasicMaterial color="#d9d9de" /></mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.4, 0, -1.15]}><planeGeometry args={[0.8, 0.1]} /><meshBasicMaterial color="#d9d9de" /></mesh>
        </group>
      ))}
      {/* start line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[9, 0.012, 0]}><planeGeometry args={[0.3, 14]} /><meshBasicMaterial color="#e7e8ec" /></mesh>
      {/* gantry */}
      <group position={[9.2, 0, 0]}>
        {[-3.6, 3.6].map(z => <mesh key={z} position={[0, 2.6, z]} castShadow><boxGeometry args={[0.2, 5.2, 0.2]} /><meshStandardMaterial color="#1a1a1c" metalness={0.7} roughness={0.4} /></mesh>)}
        <mesh position={[0, 4.6, 0]}><boxGeometry args={[0.35, 0.5, 7.4]} /><meshStandardMaterial color="#121214" metalness={0.6} roughness={0.5} /></mesh>
        {[0, 1, 2, 3, 4].map(i => (
          <group key={i} position={[-0.2, 3.9, (i - 2) * 0.9]}>
            <mesh><boxGeometry args={[0.2, 0.95, 0.6]} /><meshStandardMaterial color="#0a0a0b" /></mesh>
            {[0.2, -0.2].map((y, j) => (
              <mesh key={j} position={[-0.11, y, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.16, 0.16, 0.04, 24]} />
                <meshStandardMaterial ref={m => { if (m) lights.current[i * 2 + j] = m; }} color="#200000" emissive="#ff1a10" emissiveIntensity={0} toneMapped={false} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      <instancedMesh ref={streaks} args={[undefined as any, undefined as any, seeds.length]}>
        <boxGeometry args={[1, 0.01, 0.01]} />
        <meshBasicMaterial color="#f2f2f5" transparent opacity={0} />
      </instancedMesh>
    </group>
  );
}

/* ── Camera rig ───────────────────────────────────────────────────────────── */
function CameraRig({ trackCenter }: { trackCenter: THREE.Vector3 }) {
  const { camera, size } = useThree();
  const look = useRef(new THREE.Vector3(0, 0.5, 0));
  const pos = useRef(new THREE.Vector3(6.6, 1.75, 8.2));
  const v = useMemo(() => ({ p: new THREE.Vector3(), l: new THREE.Vector3() }), []);
  useFrame((_, dt) => {
    // Reduced motion: hold each shot instead of gliding between them
    const t = story.reduced ? (KEYS.filter(k => k.t <= story.t).pop()?.t ?? 0) : story.t;
    const s = sampleKeys(t);
    v.p.set(...s.pos);
    v.l.set(...s.look);
    // top-down follows the track centre
    const top = window01(t, 3.12, 3.92, 0.2);
    v.p.x += trackCenter.x * top; v.p.z += trackCenter.z * top;
    v.l.lerp(trackCenter, top);
    if (size.width / size.height < 1) { v.p.x -= 3.3 * top; v.l.x -= 3.3 * top; }
    // chase the launch
    if (t > 4.7 && t < 5) {
      const carX = Math.pow(smooth((t - 4.72) / 0.26), 2.2) * 46;
      v.p.x += carX * 0.82; v.l.x += carX;
    }
    // subtle handheld parallax from the pointer
    if (!story.reduced) {
      v.p.x += story.mouse.x * 0.25;
      v.p.y += story.mouse.y * 0.12;
    }
    // portrait screens need more room
    const aspect = size.width / size.height;
    const fovBoost = aspect < 1 ? 14 : aspect < 1.3 ? 6 : 0;
    const k = story.reduced ? 1 : 1 - Math.exp(-dt * 5);
    pos.current.lerp(v.p, k);
    look.current.lerp(v.l, k);
    camera.position.copy(pos.current);
    camera.lookAt(look.current);
    const cam = camera as THREE.PerspectiveCamera;
    const fov = s.fov + fovBoost;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = lerp(cam.fov, fov, k); cam.updateProjectionMatrix(); }
  });
  return null;
}

function World({ mobile }: { mobile: boolean }) {
  const circuit = useCircuit('British Grand Prix', 22);
  const center = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  return (
    <>
      <Sky />
      <fog attach="fog" args={['#060607', 14, 70]} />
      <Studio mobile={mobile} />
      <Wordmark />
      <CarRig circuit={circuit} />
      <Garage mobile={mobile} />
      <Strategy circuit={circuit} />
      <Race />
      {!story.reduced && <Sparkles count={mobile ? 30 : 70} scale={[16, 4, 12]} position={[0, 2, 0]} size={2.2} speed={0.25} opacity={0.35} color="#f0e9de" />}
      <CameraRig trackCenter={center} />
    </>
  );
}

export default function Scene({ onReady }: { onReady: () => void }) {
  const mobile = story.mobile;
  const [dpr, setDpr] = React.useState<number>(mobile ? 1.25 : 1.75);
  return (
    <Canvas
      shadows={!mobile}
      dpr={dpr}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      camera={{ position: [6.6, 1.75, 8.2], fov: 30, near: 0.1, far: 300 }}
      onCreated={() => requestAnimationFrame(() => onReady())}
      style={{ position: 'absolute', inset: 0 }}
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(mobile ? 1.25 : 1.75)} />
      <Suspense fallback={null}>
        <World mobile={mobile} />
      </Suspense>
    </Canvas>
  );
}
