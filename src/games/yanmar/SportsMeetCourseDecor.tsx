"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import type { SportsMeetPattern } from "./sportsMeet/patterns";
import { getSportsMeetTrackSegments } from "./sportsMeet/patterns";
import type { SitePoint } from "./siteLayout";
import {
  configureSiteTexture,
  PREMIUM_SITE_TEXTURES,
} from "./siteTextures";

const TRACK_Y = {
  shoulder: 0.706,
  asphalt: 0.712,
  paint: 0.718,
  kerb: 0.74,
} as const;

const TRACK_WIDTH = {
  shoulder: 8.4,
  asphalt: 5.8,
  edgeLine: 0.16,
  centerDash: 0.14,
  kerb: 0.38,
} as const;

const DASH_PERIOD = 2.6;
const DASH_LEN = 1.15;

function segmentFrame(from: SitePoint, to: SitePoint) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);
  const cx = (from[0] + to[0]) / 2;
  const cz = (from[1] + to[1]) / 2;
  const ux = length > 1e-6 ? dx / length : 0;
  const uz = length > 1e-6 ? dz / length : 1;
  const rx = uz;
  const rz = -ux;
  return { length, angle, cx, cz, ux, uz, rx, rz };
}

function TrackLane({
  from,
  to,
  width,
  y,
  material,
  height = 0.045,
}: {
  from: SitePoint;
  to: SitePoint;
  width: number;
  y: number;
  material: THREE.Material;
  height?: number;
}) {
  const { length, angle, cx, cz } = segmentFrame(from, to);
  if (length < 0.2) return null;
  return (
    <mesh
      position={[cx, y, cz]}
      rotation={[0, angle, 0]}
      material={material}
      receiveShadow
      castShadow={false}
    >
      <boxGeometry args={[width, height, length]} />
    </mesh>
  );
}

function EdgeLine({
  from,
  to,
  side,
  material,
}: {
  from: SitePoint;
  to: SitePoint;
  side: -1 | 1;
  material: THREE.Material;
}) {
  const { length, angle, cx, cz, rx, rz } = segmentFrame(from, to);
  if (length < 0.2) return null;
  const inset = TRACK_WIDTH.asphalt * 0.5 - TRACK_WIDTH.edgeLine * 0.65;
  return (
    <mesh
      position={[cx + rx * inset * side, TRACK_Y.paint, cz + rz * inset * side]}
      rotation={[0, angle, 0]}
      material={material}
      receiveShadow
      castShadow={false}
    >
      <boxGeometry args={[TRACK_WIDTH.edgeLine, 0.02, length * 0.98]} />
    </mesh>
  );
}

/** Single solid kerb — striped look via texture, not hundreds of meshes. */
function RacingKerb({
  from,
  to,
  side,
  material,
}: {
  from: SitePoint;
  to: SitePoint;
  side: -1 | 1;
  material: THREE.Material;
}) {
  const { length, angle, cx, cz, rx, rz } = segmentFrame(from, to);
  if (length < 0.25) return null;
  const offset = TRACK_WIDTH.asphalt * 0.5 + TRACK_WIDTH.kerb * 0.35;
  return (
    <mesh
      position={[cx + rx * offset * side, TRACK_Y.kerb, cz + rz * offset * side]}
      rotation={[0, angle, 0]}
      material={material}
      castShadow={false}
      receiveShadow
    >
      <boxGeometry args={[TRACK_WIDTH.kerb, 0.16, length]} />
    </mesh>
  );
}

function CornerBarrier({ x, z }: { x: number; z: number }) {
  return (
    <mesh position={[x, 1.05, z]} castShadow={false}>
      <boxGeometry args={[0.2, 1.9, 0.2]} />
      <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.45} />
    </mesh>
  );
}

function turnAngle(
  prev: SitePoint,
  curr: SitePoint,
  next: SitePoint,
): number {
  const ax = curr[0] - prev[0];
  const az = curr[1] - prev[1];
  const bx = next[0] - curr[0];
  const bz = next[1] - curr[1];
  const la = Math.hypot(ax, az);
  const lb = Math.hypot(bx, bz);
  if (la < 1e-4 || lb < 1e-4) return 0;
  const dot = Math.max(-1, Math.min(1, (ax * bx + az * bz) / (la * lb)));
  return Math.acos(dot);
}

function makeKerbStripeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#f8fafc" : "#dc2626";
      ctx.fillRect(0, i * 4, 4, 4);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function CenterDashInstances({
  segments,
  material,
}: {
  segments: Array<{ from: SitePoint; to: SitePoint }>;
  material: THREE.Material;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const dashGeo = useMemo(
    () => new THREE.BoxGeometry(TRACK_WIDTH.centerDash, 0.018, DASH_LEN),
    [],
  );

  const transforms = useMemo(() => {
    const out: Array<{
      x: number;
      y: number;
      z: number;
      angle: number;
    }> = [];
    for (const seg of segments) {
      const { length, angle, cx, cz, ux, uz } = segmentFrame(seg.from, seg.to);
      if (length < 1.2) continue;
      const count = Math.max(1, Math.floor(length / DASH_PERIOD));
      for (let i = 0; i < count; i++) {
        const along = -length * 0.5 + (i + 0.5) * (length / count);
        out.push({
          x: cx + ux * along,
          y: TRACK_Y.paint + 0.002,
          z: cz + uz * along,
          angle,
        });
      }
    }
    return out;
  }, [segments]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < transforms.length; i++) {
      const t = transforms[i]!;
      dummy.position.set(t.x, t.y, t.z);
      dummy.rotation.set(0, t.angle, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = transforms.length;
  }, [dummy, transforms]);

  useLayoutEffect(() => {
    return () => {
      dashGeo.dispose();
    };
  }, [dashGeo]);

  if (transforms.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[dashGeo, material, transforms.length]}
      castShadow={false}
      receiveShadow
      frustumCulled={false}
    />
  );
}

/** Painted premium racing corridor for the sports-meet arena. */
export function SportsMeetCourseDecor({
  pattern,
}: {
  pattern: SportsMeetPattern;
}) {
  const segments = useMemo(
    () => getSportsMeetTrackSegments(pattern),
    [pattern],
  );

  const loaded = useLoader(THREE.TextureLoader, [
    PREMIUM_SITE_TEXTURES.asphaltAlbedo,
    PREMIUM_SITE_TEXTURES.asphaltNormal,
    PREMIUM_SITE_TEXTURES.asphaltRoughness,
  ]);
  const [albedo, normal, roughness] = useMemo(
    () => loaded.map((texture) => texture.clone()),
    [loaded],
  );
  const normalScale = useMemo(() => new THREE.Vector2(0.55, 0.55), []);
  const kerbMap = useMemo(() => makeKerbStripeTexture(), []);

  useLayoutEffect(() => {
    configureSiteTexture(albedo, 3.2, 3.2, true);
    configureSiteTexture(normal, 3.2);
    configureSiteTexture(roughness, 3.2);
    return () => {
      albedo.dispose();
      normal.dispose();
      roughness.dispose();
      kerbMap.dispose();
    };
  }, [albedo, normal, roughness, kerbMap]);

  const materials = useMemo(() => {
    const shoulder = new THREE.MeshStandardMaterial({
      color: "#252b33",
      roughness: 0.96,
      metalness: 0.02,
    });
    const asphalt = new THREE.MeshStandardMaterial({
      map: albedo,
      normalMap: normal,
      normalScale,
      roughnessMap: roughness,
      roughness: 0.9,
      metalness: 0.04,
      color: "#4b5560",
    });
    const whitePaint = new THREE.MeshStandardMaterial({
      color: "#f1f5f9",
      roughness: 0.78,
      metalness: 0.02,
    });
    const yellowPaint = new THREE.MeshStandardMaterial({
      color: "#fbbf24",
      roughness: 0.72,
      metalness: 0.06,
      emissive: "#78350f",
      emissiveIntensity: 0.12,
    });
    const kerb = new THREE.MeshStandardMaterial({
      map: kerbMap,
      roughness: 0.65,
      metalness: 0.05,
    });
    kerbMap.repeat.set(1, Math.max(4, Math.round(segments.length * 0.7)));
    return { shoulder, asphalt, whitePaint, yellowPaint, kerb };
  }, [albedo, normal, roughness, normalScale, kerbMap, segments.length]);

  useLayoutEffect(() => {
    return () => {
      materials.shoulder.dispose();
      materials.asphalt.dispose();
      materials.whitePaint.dispose();
      materials.yellowPaint.dispose();
      materials.kerb.dispose();
    };
  }, [materials]);

  const cornerPosts = useMemo(() => {
    const posts: Array<{ x: number; z: number; key: string }> = [];
    for (let i = 1; i < segments.length; i++) {
      const prev = segments[i - 1]!;
      const curr = segments[i]!;
      const joint: SitePoint = curr.from;
      const angle = turnAngle(prev.from, joint, curr.to);
      if (angle < 0.35) continue;
      const { rx, rz } = segmentFrame(curr.from, curr.to);
      const outer = TRACK_WIDTH.asphalt * 0.5 + 0.85;
      const ax = joint[0] - prev.from[0];
      const az = joint[1] - prev.from[1];
      const bx = curr.to[0] - joint[0];
      const bz = curr.to[1] - joint[1];
      const cross = ax * bz - az * bx;
      const side = cross >= 0 ? 1 : -1;
      posts.push({
        x: joint[0] + rx * outer * side,
        z: joint[1] + rz * outer * side,
        key: `corner-${i}`,
      });
    }
    return posts;
  }, [segments]);

  return (
    <group>
      {segments.map((seg, i) => (
        <group key={`sports-track-${i}`}>
          <TrackLane
            from={seg.from}
            to={seg.to}
            width={TRACK_WIDTH.shoulder}
            y={TRACK_Y.shoulder}
            material={materials.shoulder}
            height={0.04}
          />
          <TrackLane
            from={seg.from}
            to={seg.to}
            width={TRACK_WIDTH.asphalt}
            y={TRACK_Y.asphalt}
            material={materials.asphalt}
            height={0.055}
          />
          <EdgeLine
            from={seg.from}
            to={seg.to}
            side={-1}
            material={materials.whitePaint}
          />
          <EdgeLine
            from={seg.from}
            to={seg.to}
            side={1}
            material={materials.whitePaint}
          />
          <RacingKerb
            from={seg.from}
            to={seg.to}
            side={-1}
            material={materials.kerb}
          />
          <RacingKerb
            from={seg.from}
            to={seg.to}
            side={1}
            material={materials.kerb}
          />
        </group>
      ))}

      <CenterDashInstances
        segments={segments}
        material={materials.yellowPaint}
      />

      {cornerPosts.map((p) => (
        <CornerBarrier key={p.key} x={p.x} z={p.z} />
      ))}

      <mesh
        position={[pattern.zones.dig[0], 0.705, pattern.zones.dig[1]]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[11, 24]} />
        <meshStandardMaterial color="#6b5340" roughness={0.95} />
      </mesh>
      <mesh
        position={[pattern.zones.crash[0], 0.705, pattern.zones.crash[1]]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[14, 24]} />
        <meshStandardMaterial color="#3f4650" roughness={0.9} />
      </mesh>
      <mesh
        position={[pattern.zones.hill[0], 0.72, pattern.zones.hill[1]]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[16, 24]} />
        <meshStandardMaterial color="#5c4a3a" roughness={0.94} />
      </mesh>
    </group>
  );
}
