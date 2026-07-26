"use client";

import { useLayoutEffect, useMemo } from "react";
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

function segmentFrame(from: SitePoint, to: SitePoint) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);
  const cx = (from[0] + to[0]) / 2;
  const cz = (from[1] + to[1]) / 2;
  const ux = length > 1e-6 ? dx / length : 0;
  const uz = length > 1e-6 ? dz / length : 1;
  // Perpendicular "right" in XZ.
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
    >
      <boxGeometry args={[TRACK_WIDTH.edgeLine, 0.02, length * 0.98]} />
    </mesh>
  );
}

function CenterDashes({
  from,
  to,
  material,
}: {
  from: SitePoint;
  to: SitePoint;
  material: THREE.Material;
}) {
  const { length, angle, cx, cz, ux, uz } = segmentFrame(from, to);
  if (length < 1.2) return null;
  const period = 2.35;
  const dashLen = 1.15;
  const count = Math.max(1, Math.floor(length / period));
  return (
    <group>
      {Array.from({ length: count }, (_, i) => {
        const along = -length * 0.5 + (i + 0.5) * (length / count);
        return (
          <mesh
            key={i}
            position={[cx + ux * along, TRACK_Y.paint + 0.002, cz + uz * along]}
            rotation={[0, angle, 0]}
            material={material}
            receiveShadow
          >
            <boxGeometry args={[TRACK_WIDTH.centerDash, 0.018, dashLen]} />
          </mesh>
        );
      })}
    </group>
  );
}

function RacingKerb({
  from,
  to,
  side,
}: {
  from: SitePoint;
  to: SitePoint;
  side: -1 | 1;
}) {
  const { length, angle, cx, cz, rx, rz } = segmentFrame(from, to);
  if (length < 0.25) return null;
  const offset = TRACK_WIDTH.asphalt * 0.5 + TRACK_WIDTH.kerb * 0.35;
  const stripeCount = Math.max(3, Math.floor(length / 0.95));
  return (
    <group
      position={[cx + rx * offset * side, TRACK_Y.kerb, cz + rz * offset * side]}
      rotation={[0, angle, 0]}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[TRACK_WIDTH.kerb, 0.16, length]} />
        <meshStandardMaterial color="#0f172a" roughness={0.7} metalness={0.08} />
      </mesh>
      {Array.from({ length: stripeCount }, (_, i) => {
        const t = (i + 0.5) / stripeCount - 0.5;
        return (
          <mesh key={i} position={[0, 0.02, t * length]} castShadow>
            <boxGeometry
              args={[TRACK_WIDTH.kerb * 0.92, 0.14, length / stripeCount]}
            />
            <meshStandardMaterial
              color={i % 2 === 0 ? "#f8fafc" : "#dc2626"}
              roughness={0.62}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function CornerBarrier({ x, z }: { x: number; z: number }) {
  return (
    <mesh position={[x, 1.05, z]} castShadow>
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

  useLayoutEffect(() => {
    configureSiteTexture(albedo, 3.2, 3.2, true);
    configureSiteTexture(normal, 3.2);
    configureSiteTexture(roughness, 3.2);
    return () => {
      albedo.dispose();
      normal.dispose();
      roughness.dispose();
    };
  }, [albedo, normal, roughness]);

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
    return { shoulder, asphalt, whitePaint, yellowPaint };
  }, [albedo, normal, roughness, normalScale]);

  useLayoutEffect(() => {
    return () => {
      materials.shoulder.dispose();
      materials.asphalt.dispose();
      materials.whitePaint.dispose();
      materials.yellowPaint.dispose();
    };
  }, [materials]);

  const cornerPosts = useMemo(() => {
    const posts: Array<{ x: number; z: number; key: string }> = [];
    for (let i = 1; i < segments.length; i++) {
      const prev = segments[i - 1]!;
      const curr = segments[i]!;
      // Shared joint ≈ curr.from / prev.to
      const joint: SitePoint = curr.from;
      const angle = turnAngle(prev.from, joint, curr.to);
      if (angle < 0.28) continue;
      const { rx, rz } = segmentFrame(curr.from, curr.to);
      const outer = TRACK_WIDTH.asphalt * 0.5 + 0.85;
      // Post on the outside of the bend.
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
          <CenterDashes
            from={seg.from}
            to={seg.to}
            material={materials.yellowPaint}
          />
          <RacingKerb from={seg.from} to={seg.to} side={-1} />
          <RacingKerb from={seg.from} to={seg.to} side={1} />
        </group>
      ))}

      {cornerPosts.map((p) => (
        <CornerBarrier key={p.key} x={p.x} z={p.z} />
      ))}

      {/* Zone pads */}
      <mesh
        position={[pattern.zones.dig[0], 0.705, pattern.zones.dig[1]]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[11, 40]} />
        <meshStandardMaterial color="#6b5340" roughness={0.95} />
      </mesh>
      <mesh
        position={[pattern.zones.crash[0], 0.705, pattern.zones.crash[1]]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[14, 40]} />
        <meshStandardMaterial color="#3f4650" roughness={0.9} />
      </mesh>
      <mesh
        position={[pattern.zones.hill[0], 0.72, pattern.zones.hill[1]]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[16, 40]} />
        <meshStandardMaterial color="#5c4a3a" roughness={0.94} />
      </mesh>
    </group>
  );
}
