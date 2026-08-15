"use client";

import { useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { YANMAR_SCENE_FONT } from "./troikaTextSetup";
import type { FloodRecoveryZone, TerrainData } from "./terrain";
import { getFloodZoneRespawnEtaSec, sampleHeight } from "./terrain";
import { FLOOD_COLLECTION_THRESHOLD } from "./floodRecovery/balance";
import { formatDumpTruckReturnTime } from "./dumpTruckState";

const GROUND_PAINT_MATERIAL = {
  transparent: true,
  depthTest: true,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
  side: THREE.DoubleSide,
  toneMapped: false,
} as const;

const GROUND_PAINT_LIFT = 0.055;

type TroikaLabel = THREE.Object3D & { text?: string };

function floodLabelText(zone: FloodRecoveryZone) {
  const respawnEtaSec = getFloodZoneRespawnEtaSec(zone);
  if (respawnEtaSec > 0) {
    return `수해복구 · 리젠 ${formatDumpTruckReturnTime(respawnEtaSec)}`;
  }
  if (zone.phase === "readyToBurn") return "소각장 밖으로 이동하세요";
  if (zone.phase === "burning") {
    return `소각 중 · ${Math.round(zone.burnProgress * 100)}%`;
  }
  if (zone.active) {
    return `수해복구 · ${zone.incineratorUnits}/${zone.incineratorCapacity}`;
  }
  return "수해복구";
}

function floodVisualSig(zone: FloodRecoveryZone) {
  return [
    zone.phase,
    zone.active ? 1 : 0,
    zone.sourceRemaining,
    zone.collectedUnits,
    zone.incineratorUnits,
    zone.incineratorCapacity,
    zone.carriedTrashId ?? "",
    Math.floor(zone.burnProgress * 20),
    zone.debris.map((d) => `${d.id}:${d.active ? 1 : 0}:${d.remaining}`).join(","),
  ].join("|");
}

export function FloodRecoveryDecor({
  terrainRef,
  showZonePaint = true,
}: {
  terrainRef: React.MutableRefObject<TerrainData>;
  showZonePaint?: boolean;
}) {
  const [, setRev] = useState(0);
  const sigRef = useRef("");
  const labelRef = useRef<TroikaLabel>(null);
  const flameRef = useRef<THREE.Mesh>(null);
  const smokeRef = useRef<THREE.Mesh>(null);

  useFrame((_, dt) => {
    const zone = terrainRef.current.floodZone;
    if (!zone) return;

    const label = labelRef.current;
    if (label && "text" in label) {
      const next = floodLabelText(zone);
      if (label.text !== next) label.text = next;
    }

    if (flameRef.current) {
      const burn = zone.phase === "burning" ? zone.burnProgress : 0;
      const pulse = zone.phase === "burning" ? 0.7 + Math.sin(performance.now() / 90) * 0.3 : 0;
      flameRef.current.scale.setScalar(0.01 + burn * 2.4 * pulse);
      flameRef.current.visible = zone.phase === "burning" || zone.phase === "readyToBurn";
      (flameRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        zone.phase === "burning" ? 1.4 + pulse : 0.35;
    }
    if (smokeRef.current) {
      const burn = zone.phase === "burning" ? zone.burnProgress : 0;
      smokeRef.current.position.y = 3.2 + burn * 4 + (dt > 0 ? Math.sin(performance.now() / 400) * 0.2 : 0);
      smokeRef.current.visible = zone.phase === "burning";
      (smokeRef.current.material as THREE.MeshStandardMaterial).opacity = 0.25 + burn * 0.45;
    }

    const nextSig = floodVisualSig(zone);
    if (nextSig === sigRef.current) return;
    sigRef.current = nextSig;
    setRev((v) => v + 1);
  });

  const zone = terrainRef.current.floodZone;
  if (!zone) return null;

  const terrain = terrainRef.current;
  const groundY = sampleHeight(terrain, zone.centerX, zone.centerZ);
  const incineratorY = sampleHeight(terrain, zone.incineratorX, zone.incineratorZ);
  const showActive =
    zone.active || zone.phase === "readyToBurn" || zone.phase === "burning";
  const collectionPct = Math.min(
    1,
    zone.collectedUnits / FLOOD_COLLECTION_THRESHOLD,
  );
  const incineratorPct = Math.min(
    1,
    zone.incineratorUnits / Math.max(1, zone.incineratorCapacity),
  );

  return (
    <group>
      {showActive && showZonePaint ? (
        <group position={[zone.centerX, groundY + GROUND_PAINT_LIFT, zone.centerZ]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
            <circleGeometry args={[zone.radius * 0.55, 48]} />
            <meshBasicMaterial color="#0ea5e9" opacity={0.14} {...GROUND_PAINT_MATERIAL} />
          </mesh>
          <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
            <ringGeometry args={[zone.radius * 0.55 - 0.3, zone.radius * 0.55 + 0.1, 64]} />
            <meshBasicMaterial color="#38bdf8" opacity={0.8} {...GROUND_PAINT_MATERIAL} />
          </mesh>
          <Text
            font={YANMAR_SCENE_FONT}
            ref={labelRef}
            position={[0, 0.006, -zone.radius * 0.55 - 1.2]}
            rotation={[-Math.PI / 2, 0, Math.PI]}
            fontSize={1.4}
            color="#e0f2fe"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.07}
            outlineColor="#0c4a6e"
            renderOrder={0}
            material-depthTest
            material-depthWrite={false}
            material-transparent
            material-toneMapped={false}
          >
            {floodLabelText(zone)}
          </Text>
        </group>
      ) : null}

      {/* Collection pad */}
      {showActive ? (
        <group
          position={[
            zone.collectionX,
            sampleHeight(terrain, zone.collectionX, zone.collectionZ) + 0.03,
            zone.collectionZ,
          ]}
        >
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[zone.collectionRadius, 40]} />
            <meshStandardMaterial color="#57534e" roughness={0.92} />
          </mesh>
          <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[zone.collectionRadius - 0.35, zone.collectionRadius - 0.1, 40]} />
            <meshStandardMaterial
              color={collectionPct >= 1 ? "#22c55e" : "#f59e0b"}
              emissive={collectionPct >= 1 ? "#14532d" : "#78350f"}
              emissiveIntensity={0.35}
            />
          </mesh>
          {collectionPct > 0.02 ? (
            <mesh position={[0, 0.25 + collectionPct * 0.7, 0]} castShadow>
              <dodecahedronGeometry args={[0.9 + collectionPct * 0.7, 0]} />
              <meshStandardMaterial color="#78716c" roughness={0.85} />
            </mesh>
          ) : null}
          <Text
            font={YANMAR_SCENE_FONT}
            position={[0, 0.08, zone.collectionRadius + 1.1]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={1.05}
            color="#f8fafc"
            outlineWidth={0.05}
            outlineColor="#111827"
          >
            {`집결 ${Math.floor(zone.collectedUnits)}/${FLOOD_COLLECTION_THRESHOLD}`}
          </Text>
        </group>
      ) : null}

      {/* Debris piles */}
      {showActive
        ? zone.debris
            .filter((d) => d.active && d.remaining > 0)
            .map((d, index) => {
              const y = sampleHeight(terrain, d.x, d.z);
              const scale = 0.45 + Math.min(1, d.remaining / 500) * 0.7;
              return (
                <group
                  key={d.id}
                  position={[d.x, y + scale * 0.4, d.z]}
                  rotation={[0, index * 0.7, 0]}
                  scale={[scale, scale * 0.7, scale]}
                >
                  <mesh castShadow receiveShadow>
                    <dodecahedronGeometry args={[1, 0]} />
                    <meshStandardMaterial color={index % 2 ? "#57534e" : "#44403c"} roughness={0.9} />
                  </mesh>
                  <mesh position={[0.3, 0.2, 0.2]} scale={[0.35, 0.2, 0.45]}>
                    <boxGeometry args={[1, 1, 1]} />
                    <meshStandardMaterial color="#a8a29e" roughness={0.75} />
                  </mesh>
                </group>
              );
            })
        : null}

      {/* Incinerator */}
      <group position={[zone.incineratorX, incineratorY, zone.incineratorZ]}>
        <mesh position={[0, 1.4, 0]} castShadow>
          <boxGeometry args={[6.5, 2.8, 5.2]} />
          <meshStandardMaterial color="#3f3f46" metalness={0.45} roughness={0.4} />
        </mesh>
        <mesh position={[0, 3.1, 0]} castShadow>
          <boxGeometry args={[5.8, 0.55, 4.6]} />
          <meshStandardMaterial color="#27272a" metalness={0.5} roughness={0.35} />
        </mesh>
        {/* Chimney */}
        <mesh position={[1.8, 5.2, -1.2]} castShadow>
          <cylinderGeometry args={[0.55, 0.7, 3.6, 12]} />
          <meshStandardMaterial color="#52525b" metalness={0.55} roughness={0.35} />
        </mesh>
        {/* Intake hatch */}
        <mesh
          position={[0, 1.5, 2.7]}
          rotation={[
            zone.phase === "burning" || zone.phase === "readyToBurn" ? -0.05 : 0.55,
            0,
            0,
          ]}
          castShadow
        >
          <boxGeometry args={[3.2, 1.8, 0.18]} />
          <meshStandardMaterial color="#b45309" metalness={0.4} roughness={0.45} />
        </mesh>
        {/* Fill level window */}
        <mesh position={[-2.2, 1.5, 0]} castShadow>
          <boxGeometry args={[0.15, 2.0, 2.4]} />
          <meshStandardMaterial color="#18181b" />
        </mesh>
        {incineratorPct > 0.02 ? (
          <mesh
            position={[-2.05, 0.55 + incineratorPct, 0]}
            scale={[1, incineratorPct * 1.7, 1]}
          >
            <boxGeometry args={[0.12, 1, 2.1]} />
            <meshStandardMaterial
              color="#a16207"
              emissive="#78350f"
              emissiveIntensity={0.4}
            />
          </mesh>
        ) : null}
        <mesh ref={flameRef} position={[0, 2.2, 0]} visible={false}>
          <coneGeometry args={[1.1, 2.4, 10]} />
          <meshStandardMaterial
            color="#fb923c"
            emissive="#ea580c"
            emissiveIntensity={1.2}
            transparent
            opacity={0.85}
          />
        </mesh>
        <mesh ref={smokeRef} position={[1.8, 7.2, -1.2]} visible={false}>
          <sphereGeometry args={[1.2, 10, 10]} />
          <meshStandardMaterial
            color="#94a3b8"
            transparent
            opacity={0.4}
            depthWrite={false}
          />
        </mesh>
        <pointLight
          position={[0, 3.5, 0]}
          color="#fb923c"
          intensity={
            zone.phase === "burning" ? 4 + zone.burnProgress * 8 : 0
          }
          distance={18}
        />
        <Text
          font={YANMAR_SCENE_FONT}
          position={[0, 0.1, 4.2]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={1.05}
          color="#fef3c7"
          outlineWidth={0.05}
          outlineColor="#111827"
        >
          {`소각장 ${Math.floor(zone.incineratorUnits)}/${zone.incineratorCapacity}`}
        </Text>
      </group>
    </group>
  );
}
