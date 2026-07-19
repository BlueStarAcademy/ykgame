"use client";

import { useLayoutEffect, useMemo, type RefObject } from "react";
import * as THREE from "three";
import { createBucketDirtTexture } from "./proceduralTextures";
import { WE } from "./workEquipment/workEquipmentStructure";
import { WorkLinkPin } from "./workEquipment/ykWorkGear";

/** Charcoal bucket + teeth — KakaoTalk reference (no chrome tips). */
/** Mid steel-gray shell — not near-black. */
const SHELL = "#6a747e";
const SHELL_DARK = "#545e68";
const SHELL_LIT = "#87919b";

/**
 * Compact four-bar: one tip pin + H-link + dogbones.
 * Plain pins only — no chrome stack that looks like extra cylinders.
 */
function PowerLink() {
  const h = WE.hLinkCylPin;
  const b = WE.hLinkBucketPin;
  const arm = { x: 0.04, y: 0.12 };
  const hMid = { x: (h.x + b.x) / 2, y: (h.y + b.y) / 2 };
  const hLen = Math.hypot(h.x - b.x, h.y - b.y);
  const hAng = Math.atan2(h.y - b.y, h.x - b.x);
  const iMid = { x: (arm.x + h.x) / 2, y: (arm.y + h.y) / 2 };
  const iLen = Math.hypot(h.x - arm.x, h.y - arm.y);
  const iAng = Math.atan2(h.y - arm.y, h.x - arm.x);

  return (
    <group>
      <WorkLinkPin x={0} y={0} radius={0.14} width={0.48} />
      {([-1, 1] as const).map((side) => (
        <mesh
          key={side}
          position={[hMid.x, hMid.y, side * 0.1]}
          rotation={[0, 0, hAng]}
          castShadow
        >
          <boxGeometry args={[hLen + 0.06, 0.11, 0.038]} />
          <meshStandardMaterial color={SHELL_DARK} roughness={0.32} metalness={0.5} />
        </mesh>
      ))}
      <mesh position={[hMid.x, hMid.y, 0]} rotation={[0, 0, hAng]} castShadow>
        <boxGeometry args={[hLen, 0.06, 0.12]} />
        <meshStandardMaterial color={SHELL} roughness={0.34} metalness={0.48} />
      </mesh>
      <WorkLinkPin x={h.x} y={h.y} radius={0.07} width={0.28} plain />
      <WorkLinkPin x={b.x} y={b.y} radius={0.075} width={0.32} plain />
      {([-1, 1] as const).map((side) => (
        <mesh
          key={`i-${side}`}
          position={[iMid.x, iMid.y, side * 0.14]}
          rotation={[0, 0, iAng]}
          castShadow
        >
          <boxGeometry args={[iLen, 0.048, 0.034]} />
          <meshStandardMaterial color={SHELL} roughness={0.34} metalness={0.48} />
        </mesh>
      ))}
      <WorkLinkPin x={arm.x} y={arm.y} radius={0.06} width={0.28} plain />
    </group>
  );
}

/**
 * Floor lip tangent near the cutting edge (into the bowl = local +X).
 * Matches floorKey [-0.88,-0.54] → [-1.06,-0.42].
 */
const CUTTING_LIP_ANGLE = Math.atan2(-0.12, 0.18);

/** Flat wedge tooth profile — reference style (not cones / rolled shanks). */
function createToothShape() {
  const s = new THREE.Shape();
  // Base at lip (+X into bowl a little), tip −X as a flat point.
  s.moveTo(0.05, 0.045);
  s.lineTo(0.05, -0.045);
  s.lineTo(-0.08, -0.038);
  s.lineTo(-0.2, -0.012);
  s.lineTo(-0.2, 0.012);
  s.lineTo(-0.08, 0.038);
  s.closePath();
  return s;
}

/**
 * Reference scraper tooth: charcoal wedge on the cutting edge,
 * same colour as the bucket shell.
 */
function Tooth({
  z,
  shape,
}: {
  z: number;
  shape: THREE.Shape;
}) {
  const depth = 0.1;
  return (
    <group position={[-1.08, -0.4, z]} rotation={[0, 0, CUTTING_LIP_ANGLE]}>
      <mesh position={[0, 0, -depth / 2]} castShadow>
        <extrudeGeometry
          args={[
            shape,
            {
              depth,
              bevelEnabled: true,
              bevelSize: 0.006,
              bevelThickness: 0.006,
              bevelSegments: 1,
            },
          ]}
        />
        <meshStandardMaterial color={SHELL} metalness={0.48} roughness={0.38} />
      </mesh>
      {/* Slight face highlight — still charcoal, not chrome */}
      <mesh position={[-0.06, 0.02, 0]} castShadow>
        <boxGeometry args={[0.16, 0.012, depth * 0.7]} />
        <meshStandardMaterial color={SHELL_LIT} metalness={0.5} roughness={0.34} />
      </mesh>
    </group>
  );
}

function lerp2(
  a: readonly [number, number],
  b: readonly [number, number],
  t: number,
): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function samplePolyline(
  pts: ReadonlyArray<readonly [number, number]>,
  segments: number,
): Array<[number, number]> {
  if (pts.length < 2) return pts.map((p) => [p[0], p[1]]);
  const out: Array<[number, number]> = [];
  const spans = pts.length - 1;
  for (let i = 0; i <= segments; i++) {
    const u = (i / segments) * spans;
    const seg = Math.min(spans - 1, Math.floor(u));
    const t = u - seg;
    out.push(lerp2(pts[seg], pts[seg + 1], t));
  }
  return out;
}

/**
 * One-piece scoop shell: continuous floor + side walls + back wall.
 * No separate plates — dirt cannot fall through gaps.
 */
function createBucketBowlGeometry(width = 0.84, wall = 0.045): THREE.BufferGeometry {
  const hw = width / 2;
  const outerHw = hw + wall;

  // Bucket-local (teeth −X): floor centerline from neck back → cutting edge.
  const floorKey: Array<readonly [number, number]> = [
    [0.05, 0.1],
    [0.02, -0.08],
    [-0.12, -0.32],
    [-0.35, -0.5],
    [-0.62, -0.58],
    [-0.88, -0.54],
    [-1.06, -0.42],
  ];
  // Top rim of the mouth (same stations).
  const rimKey: Array<readonly [number, number]> = [
    [0.08, 0.22],
    [0.02, 0.2],
    [-0.18, 0.14],
    [-0.42, 0.06],
    [-0.68, -0.02],
    [-0.92, -0.14],
    [-1.14, -0.28],
  ];

  const segments = 28;
  const floor = samplePolyline(floorKey, segments);
  const rim = samplePolyline(rimKey, segments);
  const n = floor.length;

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const push = (x: number, y: number, z: number) => {
    positions.push(x, y, z);
    normals.push(0, 0, 0);
  };

  // Station layout (8 verts each):
  // 0 inner L rim, 1 inner L floor, 2 inner R floor, 3 inner R rim
  // 4 outer L rim, 5 outer L floor, 6 outer R floor, 7 outer R rim
  for (let i = 0; i < n; i++) {
    const [fx, fy] = floor[i];
    const [rx, ry] = rim[i];
    push(rx, ry, -hw);
    push(fx, fy, -hw);
    push(fx, fy, hw);
    push(rx, ry, hw);
    push(rx, ry, -outerHw);
    push(fx - wall * 0.15, fy - wall, -outerHw);
    push(fx - wall * 0.15, fy - wall, outerHw);
    push(rx, ry, outerHw);
  }

  const quad = (a: number, b: number, c: number, d: number) => {
    indices.push(a, b, c, a, c, d);
  };

  for (let i = 0; i < n - 1; i++) {
    const a = i * 8;
    const b = (i + 1) * 8;
    // Inner cavity (facing inward — reverse winding so normals point into bowl)
    quad(a + 0, b + 0, b + 1, a + 1); // left wall inner
    quad(a + 1, b + 1, b + 2, a + 2); // floor inner
    quad(a + 2, b + 2, b + 3, a + 3); // right wall inner
    // Outer shell
    quad(a + 4, a + 5, b + 5, b + 4); // left outer
    quad(a + 5, a + 6, b + 6, b + 5); // floor outer
    quad(a + 6, a + 7, b + 7, b + 6); // right outer
    // Rim flanges (top lips)
    quad(a + 0, a + 4, b + 4, b + 0); // left rim
    quad(a + 3, b + 3, b + 7, a + 7); // right rim
  }

  // Sealed back wall at neck (station 0)
  const s0 = 0;
  quad(s0 + 0, s0 + 3, s0 + 2, s0 + 1); // inner back
  quad(s0 + 4, s0 + 5, s0 + 6, s0 + 7); // outer back
  quad(s0 + 0, s0 + 1, s0 + 5, s0 + 4);
  quad(s0 + 3, s0 + 7, s0 + 6, s0 + 2);
  quad(s0 + 0, s0 + 4, s0 + 7, s0 + 3);

  // Cutting-edge lip (last station) — closed blade face
  const sN = (n - 1) * 8;
  quad(sN + 0, sN + 1, sN + 2, sN + 3);
  quad(sN + 4, sN + 7, sN + 6, sN + 5);
  quad(sN + 0, sN + 3, sN + 7, sN + 4);
  quad(sN + 1, sN + 5, sN + 6, sN + 2);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** One-piece backhoe scoop — sealed bowl, 5 teeth, power link. */
export function ExcavatorBucket({
  dirtRef,
}: {
  dirtRef: RefObject<THREE.Mesh | null>;
}) {
  const dirtTexture = useMemo(() => createBucketDirtTexture(), []);
  const bowl = useMemo(() => createBucketBowlGeometry(), []);
  const toothShape = useMemo(() => createToothShape(), []);

  useLayoutEffect(
    () => () => {
      dirtTexture.dispose();
      bowl.dispose();
    },
    [dirtTexture, bowl],
  );

  return (
    <group>
      <PowerLink />
      <mesh geometry={bowl} castShadow receiveShadow>
        <meshStandardMaterial
          color={SHELL}
          metalness={0.52}
          roughness={0.34}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Cutting lip — same charcoal as shell (reference, not chrome) */}
      <mesh
        position={[-1.05, -0.42, 0]}
        rotation={[0, 0, CUTTING_LIP_ANGLE]}
        castShadow
      >
        <boxGeometry args={[0.14, 0.06, 0.86]} />
        <meshStandardMaterial color={SHELL_DARK} metalness={0.5} roughness={0.4} />
      </mesh>
      {[-0.32, -0.16, 0, 0.16, 0.32].map((z) => (
        <Tooth key={z} z={z} shape={toothShape} />
      ))}
      <mesh ref={dirtRef} position={[-0.5, -0.32, 0]} visible={false}>
        <boxGeometry args={[0.68, 0.28, 0.58]} />
        <meshStandardMaterial
          map={dirtTexture}
          color="#8f6438"
          roughness={0.98}
          metalness={0}
        />
      </mesh>
    </group>
  );
}
