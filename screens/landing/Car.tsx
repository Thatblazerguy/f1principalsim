import React, { forwardRef, useMemo } from 'react';
import * as THREE from 'three';
import { ACCENT, TYRE } from './story';

/*
 * A modern F1-style single-seater, modelled from primitives.
 * Nose points along +X, ground is y = 0, car is ~5.6 units long and 2 wide.
 * Carbon bodywork, gloss black paint, racing-red detailing, compound-coloured tyre sidewalls.
 * Replace with a licensed .glb via CAR_MODEL_URL in story.ts when one is available.
 */

// ── Materials ──────────────────────────────────────────────────────────────────
function carbonTexture() {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0e0e10';
  g.fillRect(0, 0, size, size);
  // 2x2 twill weave
  const cell = size / 8;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const on = (x + y) % 4 < 2;
      const grad = g.createLinearGradient(x * cell, y * cell, (x + 1) * cell, (y + 1) * cell);
      grad.addColorStop(0, on ? '#1c1c20' : '#0b0b0d');
      grad.addColorStop(1, on ? '#121215' : '#141417');
      g.fillStyle = grad;
      g.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function useCarMaterials() {
  return useMemo(() => {
    const weave = carbonTexture();
    return {
      carbon: new THREE.MeshPhysicalMaterial({ map: weave, color: '#ffffff', roughness: 0.42, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 }),
      // upgraded spec: red-tinted weave + anodised red struts
      spec: new THREE.MeshPhysicalMaterial({ map: weave, color: '#ff4a40', roughness: 0.34, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.05 }),
      specMetal: new THREE.MeshStandardMaterial({ color: '#b30500', roughness: 0.3, metalness: 1 }),
      paint: new THREE.MeshPhysicalMaterial({ color: '#0a0a0b', roughness: 0.22, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.04 }),
      red: new THREE.MeshPhysicalMaterial({ color: ACCENT, roughness: 0.3, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }),
      matte: new THREE.MeshStandardMaterial({ color: '#070708', roughness: 0.9, metalness: 0 }),
      rubber: new THREE.MeshStandardMaterial({ color: '#141415', roughness: 0.82, metalness: 0 }),
      rim: new THREE.MeshStandardMaterial({ color: '#2b2b2f', roughness: 0.28, metalness: 1 }),
      titanium: new THREE.MeshStandardMaterial({ color: '#6e6e73', roughness: 0.35, metalness: 1 }),
      soft: new THREE.MeshStandardMaterial({ color: TYRE.soft, roughness: 0.6 }),
      medium: new THREE.MeshStandardMaterial({ color: TYRE.medium, roughness: 0.6 }),
      hard: new THREE.MeshStandardMaterial({ color: TYRE.hard, roughness: 0.6 }),
    };
  }, []);
}
type Mats = ReturnType<typeof useCarMaterials>;

// ── Geometry helpers ───────────────────────────────────────────────────────────
/** Side profile (x,y) extruded symmetrically across z, with a soft bevel. */
function profileGeometry(points: [number, number][], width: number, bevel = 0.05) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, width - bevel * 2), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 16,
  });
  geo.translate(0, 0, -(width - bevel * 2) / 2);
  geo.computeVertexNormals();
  return geo;
}

/** Smooth closed profile through control points. */
function smoothProfile(pts: [number, number][], divisions = 48): [number, number][] {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal');
  return curve.getPoints(divisions).map(v => [v.x, v.y]);
}

function Strut({ from, to, r = 0.016, mat }: { from: [number, number, number]; to: [number, number, number]; r?: number; mat: THREE.Material }) {
  const { pos, quat, len } = useMemo(() => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return { pos: a.add(b).multiplyScalar(0.5), quat: q, len: dir.length() };
  }, [from, to]);
  return (
    <mesh position={pos} quaternion={quat} material={mat} castShadow>
      <cylinderGeometry args={[r, r, len, 8]} />
    </mesh>
  );
}

function Wheel({ x, z, radius, width, compound, m }: { x: number; z: number; radius: number; width: number; compound: 'soft' | 'medium' | 'hard'; m: Mats }) {
  const side = Math.sign(z);
  return (
    <group position={[x, radius, z]}>
      <group rotation={[Math.PI / 2, 0, 0]}>
        {/* tyre carcass with rounded shoulders */}
        <mesh material={m.rubber} castShadow>
          <cylinderGeometry args={[radius, radius, width, 48, 1]} />
        </mesh>
        <mesh material={m.rubber} position={[0, side * width * 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius - 0.03, 0.03, 10, 48]} />
        </mesh>
        <mesh material={m.rubber} position={[0, -side * width * 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius - 0.03, 0.03, 10, 48]} />
        </mesh>
        {/* compound band on the outer sidewall — the signature */}
        <mesh material={m[compound]} position={[0, side * (width * 0.5 + 0.031), 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius * 0.8, 0.012, 8, 64]} />
        </mesh>
        {/* rim + wheel cover */}
        <mesh material={m.rim} position={[0, side * (width * 0.5 - 0.02), 0]}>
          <cylinderGeometry args={[radius * 0.62, radius * 0.62, 0.06, 40]} />
        </mesh>
        <mesh material={m.paint} position={[0, side * (width * 0.5 + 0.015), 0]}>
          <cylinderGeometry args={[radius * 0.58, radius * 0.6, 0.02, 40]} />
        </mesh>
        <mesh material={m.titanium} position={[0, side * (width * 0.5 + 0.03), 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.04, 16]} />
        </mesh>
      </group>
    </group>
  );
}

export interface CarHandles { drs: THREE.Group | null }

export type CarPart = 'frontWing' | 'rearWing' | 'floor' | 'sidepods' | 'suspension' | 'powerUnit';

export const ProceduralCar = forwardRef<THREE.Group, { drsRef?: React.RefObject<THREE.Group | null>; compound?: 'soft' | 'medium' | 'hard'; upgraded?: Partial<Record<CarPart, boolean>> }>(
  function ProceduralCar({ drsRef, compound = 'soft', upgraded = {} }, ref) {
    const m = useCarMaterials();
    const fw = upgraded.frontWing ? m.spec : m.carbon;
    const rw = upgraded.rearWing ? m.spec : m.carbon;
    const fl = upgraded.floor ? m.spec : m.carbon;
    const sp = upgraded.sidepods ? m.spec : m.paint;
    const pu = upgraded.powerUnit ? m.spec : m.carbon;

    const geos = useMemo(() => {
      // Survival cell + nose, one smooth side profile
      const tub = profileGeometry(smoothProfile([
        [2.95, 0.2], [2.4, 0.3], [1.5, 0.46], [0.6, 0.6], [0.05, 0.66], [-0.6, 0.6], [-0.7, 0.24], [0.4, 0.16], [1.6, 0.16], [2.6, 0.15],
      ]), 0.46, 0.08);
      // Engine cover / airbox spine
      const cover = profileGeometry(smoothProfile([
        [-0.05, 0.62], [-0.15, 0.98], [-0.45, 1.02], [-1.1, 0.8], [-1.9, 0.56], [-2.25, 0.44], [-2.1, 0.32], [-0.8, 0.34],
      ]), 0.5, 0.07);
      // Sidepods (one, mirrored)
      const pod = profileGeometry(smoothProfile([
        [0.45, 0.24], [0.5, 0.6], [0.2, 0.66], [-0.6, 0.56], [-1.4, 0.38], [-1.85, 0.26], [-1.4, 0.18], [-0.4, 0.17],
      ]), 0.42, 0.07);
      // Shark fin
      const fin = profileGeometry([[-0.5, 0.9], [-1.95, 0.52], [-2.1, 0.92], [-1.2, 0.98]], 0.02, 0.004);
      // Front wing endplate and rear wing endplate outlines
      const fEnd = profileGeometry([[3.2, 0.06], [2.55, 0.06], [2.5, 0.28], [2.85, 0.32], [3.18, 0.18]], 0.025, 0.005);
      const rEnd = profileGeometry([[-2.1, 0.32], [-2.95, 0.3], [-3.0, 1.18], [-2.35, 1.2], [-2.15, 0.9]], 0.03, 0.006);
      // Halo
      const halo = new THREE.TorusGeometry(0.34, 0.032, 12, 40, Math.PI * 1.15);
      return { tub, cover, pod, fin, fEnd, rEnd, halo };
    }, []);

    const susp = upgraded.suspension ? m.specMetal : m.titanium;
    return (
      <group ref={ref} name="car">
        {/* floor + plank + diffuser */}
        <mesh material={fl} position={[-0.2, 0.09, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.6, 0.035, 1.42]} />
        </mesh>
        <mesh material={fl} position={[-2.55, 0.2, 0]} rotation={[0, 0, -0.35]} castShadow>
          <boxGeometry args={[0.6, 0.03, 1.0]} />
        </mesh>
        {/* edge wings of the floor */}
        {[-1, 1].map(s => (
          <mesh key={s} material={m.red} position={[-0.6, 0.11, s * 0.72]}>
            <boxGeometry args={[2.6, 0.012, 0.03]} />
          </mesh>
        ))}

        {/* tub + nose */}
        <mesh geometry={geos.tub} material={m.paint} castShadow />
        {/* red nose stripe */}
        <mesh material={m.red} position={[1.6, 0.47, 0]} rotation={[0, 0, -0.16]}>
          <boxGeometry args={[1.9, 0.01, 0.08]} />
        </mesh>
        {/* cockpit opening */}
        <mesh material={m.matte} position={[0.12, 0.66, 0]}>
          <boxGeometry args={[0.7, 0.04, 0.34]} />
        </mesh>
        {/* steering wheel + helmet hint */}
        <mesh material={m.matte} position={[0.35, 0.68, 0]}>
          <boxGeometry args={[0.06, 0.1, 0.24]} />
        </mesh>
        <mesh material={m.paint} position={[-0.05, 0.74, 0]}>
          <sphereGeometry args={[0.13, 24, 16]} />
        </mesh>
        <mesh material={m.red} position={[0.04, 0.76, 0]}>
          <boxGeometry args={[0.06, 0.03, 0.2]} />
        </mesh>

        {/* engine cover, airbox, fin */}
        <mesh geometry={geos.cover} material={pu} castShadow />
        <mesh material={m.matte} position={[-0.14, 0.9, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.13, 0.04, 24]} />
        </mesh>
        <mesh geometry={geos.fin} material={m.paint} castShadow />
        <mesh material={m.red} position={[-1.45, 0.86, 0]} rotation={[0, 0, -0.25]}>
          <boxGeometry args={[0.9, 0.05, 0.024]} />
        </mesh>
        {/* T-cam */}
        <mesh material={m.red} position={[-0.32, 1.06, 0]}>
          <boxGeometry args={[0.12, 0.035, 0.1]} />
        </mesh>

        {/* halo */}
        <mesh geometry={geos.halo} material={m.titanium} position={[0.02, 0.86, 0]} rotation={[Math.PI / 2, 0, -Math.PI * 0.075 + Math.PI]} castShadow />
        <Strut from={[0.36, 0.67, 0]} to={[0.33, 0.86, 0]} r={0.025} mat={m.titanium} />

        {/* sidepods + mirrors */}
        {[-1, 1].map(s => (
          <group key={s} position={[0, 0, s * 0.43]}>
            <mesh geometry={geos.pod} material={sp} castShadow />
            <mesh material={m.matte} position={[0.46, 0.42, 0]}>
              <boxGeometry args={[0.04, 0.32, 0.34]} />
            </mesh>
            <mesh material={m.red} position={[0.0, 0.62, s * 0.18]} rotation={[0, 0, -0.12]}>
              <boxGeometry args={[0.9, 0.012, 0.03]} />
            </mesh>
            <Strut from={[0.45, 0.6, s * 0.05]} to={[0.42, 0.76, s * 0.16]} r={0.012} mat={m.paint} />
            <mesh material={m.paint} position={[0.42, 0.77, s * 0.2]}>
              <boxGeometry args={[0.06, 0.06, 0.14]} />
            </mesh>
          </group>
        ))}

        {/* front wing: main plane + three flaps + endplates */}
        <group name="frontWing">
          <mesh material={fw} position={[2.85, 0.11, 0]} castShadow>
            <boxGeometry args={[0.42, 0.022, 1.92]} />
          </mesh>
          {[0, 1, 2].map(i => (
            <mesh key={i} material={i === 2 ? m.red : fw} position={[2.68 - i * 0.07, 0.16 + i * 0.05, 0]} rotation={[0, 0, 0.18 + i * 0.12]} castShadow>
              <boxGeometry args={[0.2 - i * 0.03, 0.014, 1.88 - i * 0.14]} />
            </mesh>
          ))}
          {[-1, 1].map(s => <mesh key={s} geometry={geos.fEnd} material={fw} position={[0, 0, s * 0.96]} castShadow />)}
          <Strut from={[2.55, 0.22, 0.12]} to={[2.75, 0.12, 0.2]} r={0.012} mat={fw} />
          <Strut from={[2.55, 0.22, -0.12]} to={[2.75, 0.12, -0.2]} r={0.012} mat={fw} />
        </group>

        {/* rear wing: endplates, main plane, DRS flap (pivots), beam wing, swan neck */}
        <group name="rearWing">
          {[-1, 1].map(s => (
            <group key={s}>
              <mesh geometry={geos.rEnd} material={rw} position={[0, 0, s * 0.52]} castShadow />
              <mesh material={m.red} position={[-2.98, 0.74, s * 0.535]} rotation={[0, 0, 0.03]}>
                <boxGeometry args={[0.03, 0.86, 0.012]} />
              </mesh>
            </group>
          ))}
          <mesh material={rw} position={[-2.62, 0.98, 0]} rotation={[0, 0, 0.12]} castShadow>
            <boxGeometry args={[0.46, 0.028, 1.02]} />
          </mesh>
          <group ref={drsRef as any} position={[-2.42, 1.04, 0]}>
            <mesh material={m.paint} position={[-0.17, 0.05, 0]} rotation={[0, 0, 0.42]} castShadow>
              <boxGeometry args={[0.36, 0.022, 1.02]} />
            </mesh>
            <mesh material={m.red} position={[-0.33, 0.12, 0]} rotation={[0, 0, 0.42]}>
              <boxGeometry args={[0.03, 0.024, 1.02]} />
            </mesh>
          </group>
          <mesh material={rw} position={[-2.55, 0.42, 0]} rotation={[0, 0, 0.2]} castShadow>
            <boxGeometry args={[0.3, 0.02, 0.9]} />
          </mesh>
          <Strut from={[-2.2, 0.45, 0]} to={[-2.55, 0.98, 0]} r={0.02} mat={m.carbon} />
          {/* rain light */}
          <mesh position={[-2.86, 0.4, 0]}>
            <boxGeometry args={[0.02, 0.06, 0.14]} />
            <meshStandardMaterial color="#3a0000" emissive={ACCENT} emissiveIntensity={1.6} />
          </mesh>
        </group>

        {/* suspension: double wishbones + push/pull rods */}
        {[-1, 1].map(s => (
          <group key={s}>
            {/* front */}
            <Strut from={[1.95, 0.48, s * 0.22]} to={[1.78, 0.44, s * 0.8]} mat={susp} />
            <Strut from={[1.45, 0.48, s * 0.22]} to={[1.72, 0.44, s * 0.8]} mat={susp} />
            <Strut from={[1.95, 0.24, s * 0.22]} to={[1.78, 0.28, s * 0.82]} mat={susp} />
            <Strut from={[1.4, 0.24, s * 0.22]} to={[1.72, 0.28, s * 0.82]} mat={susp} />
            <Strut from={[1.7, 0.55, s * 0.24]} to={[1.75, 0.27, s * 0.78]} r={0.012} mat={susp} />
            {/* rear */}
            <Strut from={[-1.4, 0.5, s * 0.25]} to={[-1.72, 0.46, s * 0.8]} mat={susp} />
            <Strut from={[-2.05, 0.5, s * 0.22]} to={[-1.78, 0.46, s * 0.8]} mat={susp} />
            <Strut from={[-1.35, 0.24, s * 0.28]} to={[-1.72, 0.27, s * 0.82]} mat={susp} />
            <Strut from={[-2.0, 0.24, s * 0.22]} to={[-1.78, 0.27, s * 0.82]} mat={susp} />
          </group>
        ))}

        {/* wheels */}
        <Wheel x={1.76} z={0.86} radius={0.36} width={0.34} compound={compound} m={m} />
        <Wheel x={1.76} z={-0.86} radius={0.36} width={0.34} compound={compound} m={m} />
        <Wheel x={-1.76} z={0.84} radius={0.37} width={0.42} compound={compound} m={m} />
        <Wheel x={-1.76} z={-0.84} radius={0.37} width={0.42} compound={compound} m={m} />
      </group>
    );
  }
);

/** 3D anchor points for engineering annotations (car-local space). */
export const ANCHORS = {
  frontWing: [3.05, 0.22, 0.7] as [number, number, number],
  suspension: [1.6, 0.47, 0.6] as [number, number, number],
  tyres: [-1.76, 0.72, 1.05] as [number, number, number],
  powerUnit: [-0.9, 0.85, 0.3] as [number, number, number],
  rearWing: [-2.75, 1.15, 0.5] as [number, number, number],
  airflow: [0.6, 1.25, 0] as [number, number, number],
};
