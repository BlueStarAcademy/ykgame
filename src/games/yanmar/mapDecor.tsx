"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  createCompactedDirtTexture,
  createGravelTexture,
  createPaintedMetalTexture,
} from "./proceduralTextures";
import { DIG_ZONE, DUMP_ZONE, getActiveDigZones, sampleHeight, type TerrainData } from "./terrain";

function RoadMesh({
  from,
  to,
  width,
  texture,
  y = 0.715,
}: {
  from: [number, number];
  to: [number, number];
  width: number;
  texture: THREE.Texture;
  y?: number;
}) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const angle = Math.atan2(to[0] - from[0], to[1] - from[1]);
  const cx = (from[0] + to[0]) / 2;
  const cz = (from[1] + to[1]) / 2;

  return (
    <mesh position={[cx, y, cz]} rotation={[0, angle, 0]} receiveShadow>
      <boxGeometry args={[width, 0.06, length]} />
      <meshStandardMaterial map={texture} color="#c8b59a" roughness={0.94} metalness={0.02} />
    </mesh>
  );
}

export function MapSiteDecor({
  terrainRef,
}: {
  terrainRef: React.MutableRefObject<TerrainData>;
}) {
  const gravelTexture = useMemo(() => createGravelTexture(), []);
  const compactTexture = useMemo(() => createCompactedDirtTexture(), []);
  const metalTexture = useMemo(() => createPaintedMetalTexture(), []);

  useLayoutEffect(
    () => () => {
      gravelTexture.dispose();
      compactTexture.dispose();
      metalTexture.dispose();
    },
    [gravelTexture, compactTexture, metalTexture],
  );

  return (
    <group>
      <RoadMesh
        from={[-18, -22]}
        to={[DIG_ZONE.x, DIG_ZONE.z]}
        width={5.6}
        texture={compactTexture}
      />
      <RoadMesh
        from={[DIG_ZONE.x, DIG_ZONE.z]}
        to={[DUMP_ZONE.x, DUMP_ZONE.z]}
        width={4.8}
        texture={compactTexture}
        y={0.708}
      />
      <mesh position={[DUMP_ZONE.x, 0.72, DUMP_ZONE.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[DUMP_ZONE.radius + 2.2, 48]} />
        <meshStandardMaterial
          map={gravelTexture}
          color="#bfb09a"
          roughness={0.92}
          metalness={0.03}
        />
      </mesh>
      <DigMoundCollars terrainRef={terrainRef} />
      <SiteBarrierRow texture={metalTexture} />
    </group>
  );
}

function DigMoundCollars({
  terrainRef,
}: {
  terrainRef: React.MutableRefObject<TerrainData>;
}) {
  const [zones, setZones] = useState(() => getActiveDigZones(terrainRef.current));
  const signatureRef = useRef("");

  useFrame(() => {
    const signature = terrainRef.current.digZones
      .map((zone) => `${zone.id}:${zone.x}:${zone.z}:${zone.active}`)
      .join("|");
    if (signature !== signatureRef.current) {
      signatureRef.current = signature;
      setZones([...getActiveDigZones(terrainRef.current)]);
    }
  });

  return (
    <>
      {zones.map((zone) => {
        const baseY = sampleHeight(terrainRef.current, zone.x, zone.z) + 0.04;
        return (
          <group key={zone.id} position={[zone.x, baseY, zone.z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[zone.radius - 0.35, zone.radius + 0.15, 64]} />
              <meshStandardMaterial
                color="#9a7048"
                roughness={0.96}
                metalness={0}
                transparent
                opacity={0.42}
              />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
              <ringGeometry args={[zone.radius * 0.55, zone.radius * 0.62, 48]} />
              <meshStandardMaterial color="#c49a62" roughness={0.9} transparent opacity={0.28} />
            </mesh>
            {[0, 1, 2].map((i) => {
              const angle = (i / 3) * Math.PI * 2 + 0.4;
              const rx = Math.cos(angle) * (zone.radius * 0.78);
              const rz = Math.sin(angle) * (zone.radius * 0.78);
              const h = sampleHeight(terrainRef.current, zone.x + rx, zone.z + rz);
              return (
                <mesh
                  key={i}
                  position={[rx, h - baseY + 0.12, rz]}
                  scale={[1.4, 0.55, 1.2]}
                >
                  <dodecahedronGeometry args={[0.42, 0]} />
                  <meshStandardMaterial color="#8b6840" roughness={0.95} />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </>
  );
}

function SiteBarrierRow({ texture }: { texture: THREE.Texture }) {
  const posts: [number, number][] = [
    [-30, -28],
    [-8, -32],
    [14, -30],
    [36, -22],
    [40, 0],
    [38, 22],
    [12, 34],
    [-14, 36],
    [-32, 26],
    [-36, 4],
  ];

  return (
    <group>
      {posts.map(([x, z], index) => {
        const next = posts[(index + 1) % posts.length];
        const mx = (x + next[0]) / 2;
        const mz = (z + next[1]) / 2;
        const len = Math.hypot(next[0] - x, next[1] - z);
        const angle = Math.atan2(next[0] - x, next[1] - z);
        return (
          <group key={`${x}:${z}`}>
            <mesh position={[x, 0.55, z]}>
              <cylinderGeometry args={[0.05, 0.07, 1.1, 10]} />
              <meshStandardMaterial map={texture} color="#d4d8de" roughness={0.42} metalness={0.55} />
            </mesh>
            <mesh position={[mx, 0.92, mz]} rotation={[0, angle, 0]}>
              <boxGeometry args={[0.06, 0.14, len]} />
              <meshStandardMaterial color="#ff5a1f" roughness={0.48} />
            </mesh>
            <mesh position={[mx, 1.02, mz]} rotation={[0, angle, 0]}>
              <boxGeometry args={[0.04, 0.08, len - 0.2]} />
              <meshStandardMaterial color="#ffffff" roughness={0.35} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
