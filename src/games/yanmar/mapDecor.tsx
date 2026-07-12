"use client";

/* eslint-disable react-hooks/refs */

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import {
  createCompactedDirtTexture,
  createGravelTexture,
  createPaintedMetalTexture,
} from "./proceduralTextures";
import { getDumpTruckLaneSegment, DUMP_TRUCK_LANE_LENGTH } from "./dumpTruckLane";
import {
  getHaulTruckLaneSegment,
  HAUL_TRUCK_LANE_LENGTH,
} from "./haulTruckLane";
import { getSiteRoadsForTier } from "./siteLayout";
import {
  DUMP_TRUCK,
  DUMP_ZONE,
  HAUL_TRUCK,
  getActiveDigZones,
  getMapWorldBounds,
  sampleHeight,
  type TerrainData,
} from "./terrain";
import type { ExcavatorSimState } from "./types";
import {
  configureSiteTexture,
  PREMIUM_SITE_TEXTURES,
} from "./siteTextures";

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

function TruckDepartureLane({
  compactTexture,
  gravelTexture,
}: {
  compactTexture: THREE.Texture;
  gravelTexture: THREE.Texture;
}) {
  const { startX, startZ, endX, endZ, dirX, dirZ } = getDumpTruckLaneSegment();
  const laneLength = DUMP_TRUCK_LANE_LENGTH;
  const laneWidth = 4.6;
  const cx = (startX + endX) / 2;
  const cz = (startZ + endZ) / 2;
  const angle = Math.atan2(endX - startX, endZ - startZ);
  const dashCount = 11;

  return (
    <group>
      <mesh position={[cx, 0.702, cz]} rotation={[0, angle, 0]} receiveShadow>
        <boxGeometry args={[laneWidth, 0.05, laneLength]} />
        <meshStandardMaterial map={compactTexture} color="#9a8b72" roughness={0.96} metalness={0.02} />
      </mesh>
      <mesh position={[cx, 0.708, cz]} rotation={[0, angle, 0]} receiveShadow>
        <boxGeometry args={[laneWidth + 0.5, 0.04, laneLength + 0.8]} />
        <meshStandardMaterial map={gravelTexture} color="#7a6f5c" roughness={0.98} metalness={0.01} transparent opacity={0.35} />
      </mesh>
      {Array.from({ length: dashCount }, (_, i) => {
        const t = (i + 0.5) / dashCount;
        const px = startX + dirX * laneLength * t;
        const pz = startZ + dirZ * laneLength * t;
        return (
          <mesh key={`dash-${i}`} position={[px, 0.716, pz]} rotation={[0, angle, 0]}>
            <boxGeometry args={[0.14, 0.02, 1.35]} />
            <meshStandardMaterial color="#f5d565" roughness={0.55} emissive="#fbbf24" emissiveIntensity={0.08} />
          </mesh>
        );
      })}
      {[-1, 1].map((side) => (
        <mesh
          key={`edge-${side}`}
          position={[
            cx + Math.cos(angle + Math.PI / 2) * side * (laneWidth / 2 + 0.08),
            0.714,
            cz + Math.sin(angle + Math.PI / 2) * side * (laneWidth / 2 + 0.08),
          ]}
          rotation={[0, angle, 0]}
        >
          <boxGeometry args={[0.08, 0.025, laneLength]} />
          <meshStandardMaterial color="#e8edf2" roughness={0.42} />
        </mesh>
      ))}
      <mesh
        position={[DUMP_TRUCK.groupX, 0.698, DUMP_TRUCK.groupZ]}
        rotation={[-Math.PI / 2, 0, DUMP_TRUCK.rotation]}
        receiveShadow
      >
        <planeGeometry args={[7.2, 5.4]} />
        <meshStandardMaterial map={gravelTexture} color="#b5a48c" roughness={0.94} metalness={0.02} />
      </mesh>
      <mesh position={[endX, 0.704, endZ]} rotation={[-Math.PI / 2, 0, angle]}>
        <ringGeometry args={[2.4, 3.6, 32, 1, 0, Math.PI]} />
        <meshStandardMaterial map={compactTexture} color="#8f8270" roughness={0.95} />
      </mesh>
    </group>
  );
}

function HaulTruckDepartureLane({
  compactTexture,
  gravelTexture,
}: {
  compactTexture: THREE.Texture;
  gravelTexture: THREE.Texture;
}) {
  const { startX, startZ, endX, endZ, dirX, dirZ } = getHaulTruckLaneSegment();
  const laneLength = HAUL_TRUCK_LANE_LENGTH;
  const laneWidth = 4.8;
  const cx = (startX + endX) / 2;
  const cz = (startZ + endZ) / 2;
  const angle = Math.atan2(endX - startX, endZ - startZ);
  const dashCount = 10;

  return (
    <group>
      <mesh position={[cx, 0.702, cz]} rotation={[0, angle, 0]} receiveShadow>
        <boxGeometry args={[laneWidth, 0.05, laneLength]} />
        <meshStandardMaterial map={compactTexture} color="#8f8678" roughness={0.96} metalness={0.02} />
      </mesh>
      <mesh position={[cx, 0.708, cz]} rotation={[0, angle, 0]} receiveShadow>
        <boxGeometry args={[laneWidth + 0.55, 0.04, laneLength + 0.8]} />
        <meshStandardMaterial
          map={gravelTexture}
          color="#6f6758"
          roughness={0.98}
          metalness={0.01}
          transparent
          opacity={0.38}
        />
      </mesh>
      {Array.from({ length: dashCount }, (_, i) => {
        const t = (i + 0.5) / dashCount;
        const px = startX + dirX * laneLength * t;
        const pz = startZ + dirZ * laneLength * t;
        return (
          <mesh key={`haul-dash-${i}`} position={[px, 0.716, pz]} rotation={[0, angle, 0]}>
            <boxGeometry args={[0.14, 0.02, 1.3]} />
            <meshStandardMaterial
              color="#f5d565"
              roughness={0.55}
              emissive="#fbbf24"
              emissiveIntensity={0.08}
            />
          </mesh>
        );
      })}
      {[-1, 1].map((side) => (
        <mesh
          key={`haul-edge-${side}`}
          position={[
            cx + Math.cos(angle + Math.PI / 2) * side * (laneWidth / 2 + 0.08),
            0.714,
            cz + Math.sin(angle + Math.PI / 2) * side * (laneWidth / 2 + 0.08),
          ]}
          rotation={[0, angle, 0]}
        >
          <boxGeometry args={[0.08, 0.025, laneLength]} />
          <meshStandardMaterial color="#e8edf2" roughness={0.42} />
        </mesh>
      ))}
      <mesh
        position={[HAUL_TRUCK.groupX, 0.698, HAUL_TRUCK.groupZ]}
        rotation={[-Math.PI / 2, 0, HAUL_TRUCK.rotation]}
        receiveShadow
      >
        <planeGeometry args={[7.6, 5.8]} />
        <meshStandardMaterial map={gravelTexture} color="#a89a84" roughness={0.94} metalness={0.02} />
      </mesh>
      <mesh position={[endX, 0.704, endZ]} rotation={[-Math.PI / 2, 0, angle]}>
        <ringGeometry args={[2.4, 3.6, 32, 1, 0, Math.PI]} />
        <meshStandardMaterial map={compactTexture} color="#8f8270" roughness={0.95} />
      </mesh>
    </group>
  );
}

export function MapSiteDecor({
  terrainRef,
  simRef,
}: {
  terrainRef: React.MutableRefObject<TerrainData>;
  simRef?: React.MutableRefObject<ExcavatorSimState>;
}) {
  const gravelTexture = useMemo(() => createGravelTexture(), []);
  const compactTexture = useMemo(() => createCompactedDirtTexture(), []);
  const metalTexture = useMemo(() => createPaintedMetalTexture(), []);
  const loadedGroundTextures = useLoader(
    THREE.TextureLoader,
    [
      PREMIUM_SITE_TEXTURES.groundAlbedo,
      PREMIUM_SITE_TEXTURES.groundNormal,
      PREMIUM_SITE_TEXTURES.groundRoughness,
    ],
  );
  const [groundAlbedo, groundNormal, groundRoughness] = useMemo(
    () => loadedGroundTextures.map((texture) => texture.clone()),
    [loadedGroundTextures],
  );

  useLayoutEffect(() => {
    configureSiteTexture(groundAlbedo, 8, 2, true);
    configureSiteTexture(groundNormal, 8, 2);
    configureSiteTexture(groundRoughness, 8, 2);
    return () => {
      groundAlbedo.dispose();
      groundNormal.dispose();
      groundRoughness.dispose();
    };
  }, [groundAlbedo, groundNormal, groundRoughness]);

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
      {getSiteRoadsForTier(terrainRef.current.mapTier).map((road) => (
        <RoadMesh
          key={road.id}
          from={[road.from[0], road.from[1]]}
          to={[road.to[0], road.to[1]]}
          width={road.width}
          texture={road.surface === "gravel" ? gravelTexture : compactTexture}
          y={0.735}
        />
      ))}
      <TruckDepartureLane compactTexture={compactTexture} gravelTexture={gravelTexture} />
      <HaulTruckDepartureLane compactTexture={compactTexture} gravelTexture={gravelTexture} />
      <mesh position={[DUMP_ZONE.x, 0.72, DUMP_ZONE.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[DUMP_ZONE.radius + 2.2, 48]} />
        <meshStandardMaterial
          map={gravelTexture}
          color="#bfb09a"
          roughness={0.92}
          metalness={0.03}
        />
      </mesh>
      <DigMoundCollars terrainRef={terrainRef} simRef={simRef} />
      <SiteBarrierRow
        texture={metalTexture}
        terrain={terrainRef.current}
      />
      <PremiumSiteInfrastructure
        terrain={terrainRef.current}
        groundAlbedo={groundAlbedo}
        groundNormal={groundNormal}
        groundRoughness={groundRoughness}
      />
    </group>
  );
}

function DigMoundCollars({
  terrainRef,
  simRef,
}: {
  terrainRef: React.MutableRefObject<TerrainData>;
  simRef?: React.MutableRefObject<ExcavatorSimState>;
}) {
  const [zones, setZones] = useState(() => getActiveDigZones(terrainRef.current));
  const [occupiedIds, setOccupiedIds] = useState<string[]>([]);
  const signatureRef = useRef("");
  const collarGroupRefs = useRef(new Map<string, THREE.Group>());

  useFrame(() => {
    const nextZones = getActiveDigZones(terrainRef.current);
    const sim = simRef?.current;
    const nextOccupied = sim
      ? nextZones
          .filter((zone) => Math.hypot(zone.x - sim.posX, zone.z - sim.posZ) < zone.radius)
          .map((zone) => zone.id)
          .sort()
      : [];
    const signature =
      terrainRef.current.digZones
        .map((zone) => `${zone.id}:${zone.x}:${zone.z}:${zone.active}`)
        .join("|") + `|occ:${nextOccupied.join(",")}`;
    if (signature !== signatureRef.current) {
      signatureRef.current = signature;
      setZones([...nextZones]);
      setOccupiedIds(nextOccupied);
    }

    for (const zone of nextZones) {
      const group = collarGroupRefs.current.get(zone.id);
      if (!group) continue;
      const samples = 12;
      const heights: number[] = [];
      const ringR = Math.max(1.2, zone.radius * 0.92);
      for (let i = 0; i < samples; i += 1) {
        const angle = (i / samples) * Math.PI * 2;
        heights.push(
          sampleHeight(
            terrainRef.current,
            zone.x + Math.cos(angle) * ringR,
            zone.z + Math.sin(angle) * ringR,
          ),
        );
      }
      heights.sort((a, b) => a - b);
      const median = heights[Math.floor(heights.length / 2)] ?? heights[0] ?? 0;
      group.position.y = median + 0.055;
    }
  });

  const occupied = useMemo(() => new Set(occupiedIds), [occupiedIds]);

  return (
    <>
      {zones.map((zone) => {
        const samples = 12;
        const heights: number[] = [];
        const ringR = Math.max(1.2, zone.radius * 0.92);
        for (let i = 0; i < samples; i += 1) {
          const angle = (i / samples) * Math.PI * 2;
          heights.push(
            sampleHeight(
              terrainRef.current,
              zone.x + Math.cos(angle) * ringR,
              zone.z + Math.sin(angle) * ringR,
            ),
          );
        }
        heights.sort((a, b) => a - b);
        const median = heights[Math.floor(heights.length / 2)] ?? heights[0] ?? 0;
        const baseY = median + 0.055;
        const inside = occupied.has(zone.id);
        return (
          <group
            key={zone.id}
            position={[zone.x, baseY, zone.z]}
            ref={(node) => {
              if (node) collarGroupRefs.current.set(zone.id, node);
              else collarGroupRefs.current.delete(zone.id);
            }}
          >
            {/* Hide collar rings when inside — ZoneMarkers shows diggable dirt edge instead */}
            {!inside ? (
              <>
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
              </>
            ) : null}
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

function SiteBarrierRow({
  texture,
  terrain,
}: {
  texture: THREE.Texture;
  terrain: TerrainData;
}) {
  const bounds = getMapWorldBounds(terrain);
  const inset = 4;
  const posts: [number, number][] = [
    [bounds.minX + inset, bounds.minZ + inset],
    [(bounds.minX + bounds.maxX) / 2, bounds.minZ + inset],
    [bounds.maxX - inset, bounds.minZ + inset],
    [bounds.maxX - inset, (bounds.minZ + bounds.maxZ) / 2],
    [bounds.maxX - inset, bounds.maxZ - inset],
    [(bounds.minX + bounds.maxX) / 2, bounds.maxZ - inset],
    [bounds.minX + inset, bounds.maxZ - inset],
    [bounds.minX + inset, (bounds.minZ + bounds.maxZ) / 2],
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

function KoreanSafetySign({
  position,
  rotation = 0,
  title,
}: {
  position: [number, number, number];
  rotation?: number;
  title: string;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {[-1.35, 1.35].map((x) => (
        <mesh key={x} position={[x, -0.75, 0]}>
          <boxGeometry args={[0.1, 2.2, 0.1]} />
          <meshStandardMaterial color="#334155" metalness={0.62} roughness={0.36} />
        </mesh>
      ))}
      <mesh>
        <boxGeometry args={[3.2, 1.35, 0.12]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.38} />
      </mesh>
      <mesh position={[0, 0.43, 0.07]}>
        <boxGeometry args={[3.05, 0.34, 0.035]} />
        <meshStandardMaterial color="#dc2626" roughness={0.42} />
      </mesh>
      <Text
        position={[0, -0.12, 0.09]}
        fontSize={0.42}
        color="#111827"
        anchorX="center"
        anchorY="middle"
      >
        {title}
      </Text>
      <Text
        position={[0, -0.48, 0.09]}
        fontSize={0.19}
        color="#475569"
        anchorX="center"
      >
        안전모 착용 · 관계자 외 출입금지
      </Text>
    </group>
  );
}

function PremiumSiteInfrastructure({
  terrain,
  groundAlbedo,
  groundNormal,
  groundRoughness,
}: {
  terrain: TerrainData;
  groundAlbedo: THREE.Texture;
  groundNormal: THREE.Texture;
  groundRoughness: THREE.Texture;
}) {
  const bounds = getMapWorldBounds(terrain);
  const eastX = bounds.maxX - 7;
  const northZ = bounds.maxZ - 7;
  const pipeX = terrain.mapTier >= 2 ? 66 : 55;
  return (
    <group>
      {/* Concrete drainage channel beside the main haul road. */}
      <group position={[7, 0.73, -0.4]} rotation={[0, -0.5, 0]}>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 2.9, -0.08, 0]} receiveShadow>
            <boxGeometry args={[0.28, 0.24, 45]} />
            <meshStandardMaterial color="#8f9698" roughness={0.86} />
          </mesh>
        ))}
        <mesh position={[0, -0.15, 0]} receiveShadow>
          <boxGeometry args={[5.5, 0.05, 45]} />
          <meshStandardMaterial
            map={groundAlbedo}
            normalMap={groundNormal}
            roughnessMap={groundRoughness}
            color="#8d7658"
            roughness={0.96}
          />
        </mesh>
      </group>

      {/* Stacked steel pipes and precast barriers. */}
      <group position={[pipeX, 1.05, -25]}>
        {Array.from({ length: 12 }, (_, index) => {
          const row = Math.floor(index / 4);
          const col = index % 4;
          return (
            <mesh
              key={index}
              position={[0, row * 0.48, (col - 1.5) * 0.52]}
              rotation={[0, 0, Math.PI / 2]}
              castShadow
            >
              <cylinderGeometry args={[0.2, 0.2, 8, 18, 1, true]} />
              <meshStandardMaterial color="#56616a" metalness={0.72} roughness={0.35} />
            </mesh>
          );
        })}
      </group>
      {Array.from({ length: terrain.mapTier >= 2 ? 10 : 6 }, (_, index) => (
        <group key={index} position={[eastX, 0.95, -22 + index * 5.5]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.2, 1.05, 4.8]} />
            <meshStandardMaterial color="#c7c4ba" roughness={0.92} />
          </mesh>
          <mesh position={[-0.64, 0.18, 0]}>
            <boxGeometry args={[0.08, 0.22, 3.8]} />
            <meshStandardMaterial color={index % 2 ? "#f8fafc" : "#ef4444"} />
          </mesh>
        </group>
      ))}

      {/* Green Korean construction safety mesh around the north edge. */}
      <mesh
        position={[(bounds.minX + bounds.maxX) / 2, 1.45, northZ]}
        receiveShadow
      >
        <planeGeometry args={[bounds.maxX - bounds.minX - 16, 2.5, 28, 1]} />
        <meshStandardMaterial
          color="#167b57"
          transparent
          opacity={0.58}
          roughness={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>
      <KoreanSafetySign
        position={[-30, 2.05, -37]}
        rotation={0}
        title="YK건기 스마트 작업장"
      />
      {terrain.mapTier >= 2 ? (
        <KoreanSafetySign
          position={[83, 2.05, 3]}
          rotation={Math.PI / 2}
          title="노면 파쇄 작업구역"
        />
      ) : null}
      {terrain.mapTier >= 3 ? (
        <KoreanSafetySign
          position={[7, 2.05, 83]}
          title="석재 운반 작업구역"
        />
      ) : null}
    </group>
  );
}
