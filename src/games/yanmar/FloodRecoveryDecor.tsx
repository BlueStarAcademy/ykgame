"use client";

import { useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { useTranslations } from "next-intl";
import { YANMAR_SCENE_FONT } from "./troikaTextSetup";
import type { FloodRecoveryZone, TerrainData } from "./terrain";
import { getFloodZoneRespawnEtaSec, sampleHeight } from "./terrain";
import {
  FLOOD_COLLECTION_ACCEPT_MARGIN,
  FLOOD_COLLECTION_GRAB_RADIUS,
  FLOOD_COLLECTION_THRESHOLD,
} from "./floodRecovery/balance";
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

function FloodTrashPile({
  amount,
  variant,
  scraped = false,
}: {
  amount: number;
  variant: number;
  scraped?: boolean;
}) {
  const fullness = Math.max(0.55, Math.min(1, amount / 160));
  const junkColors = ["#ef4444", "#f59e0b", "#38bdf8", "#e5e7eb", "#a3e635", "#f472b6"];
  const pieces = Array.from({ length: scraped ? 10 : 12 }, (_, index) => {
    const angle = index * 2.15 + variant * 0.61;
    const radius = scraped
      ? 0.35 + (index % 4) * 0.28
      : 0.55 + (index % 5) * 0.32;
    const lateral = scraped ? ((index % 6) - 2.5) * 0.38 : Math.cos(angle) * radius;
    const depth = scraped ? ((index % 3) - 1) * 0.22 : Math.sin(angle) * radius;
    return {
      x: lateral,
      z: depth,
      y: 0.12 + (index % 4) * 0.08,
      yaw: scraped ? index * 0.48 : angle + index * 0.35,
      color: junkColors[(index + variant) % junkColors.length]!,
      kind: index % 3,
    };
  });

  return (
    <group
      scale={
        scraped
          ? [fullness * 1.55, 0.95 + fullness * 0.35, fullness * 1.15]
          : [fullness * 1.45, 1.05 + fullness * 0.4, fullness * 1.45]
      }
    >
      {/* Ground marker ring — shows players where to drive the blade. */}
      <mesh
        position={[0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={1}
      >
        <ringGeometry
          args={scraped ? [1.15, 1.55, 36] : [1.35, 1.85, 40]}
        />
        <meshBasicMaterial
          color={scraped ? "#fbbf24" : "#38bdf8"}
          transparent
          opacity={scraped ? 0.85 : 0.78}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh
        position={[0, 0.015, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={1}
      >
        <circleGeometry args={[scraped ? 1.15 : 1.35, 28]} />
        <meshBasicMaterial
          color={scraped ? "#78350f" : "#0c4a6e"}
          transparent
          opacity={0.28}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Chunk mound — reads clearly from cockpit height. */}
      <mesh
        position={[0, 0.28, 0]}
        scale={scraped ? [1.65, 0.55, 1.15] : [1.55, 0.7, 1.45]}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[0.95, 14, 10]} />
        <meshStandardMaterial color="#1f2937" roughness={0.94} />
      </mesh>
      <mesh
        position={scraped ? [0.35, 0.32, -0.12] : [0.4, 0.38, -0.25]}
        scale={scraped ? [1.25, 0.48, 0.95] : [1.15, 0.55, 1.05]}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[0.72, 12, 9]} />
        <meshStandardMaterial color="#334155" roughness={0.9} />
      </mesh>
      <mesh
        position={scraped ? [-0.4, 0.34, 0.08] : [-0.35, 0.4, 0.2]}
        scale={scraped ? [1.1, 0.42, 0.9] : [1.05, 0.5, 1.0]}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[0.62, 11, 8]} />
        <meshStandardMaterial color="#3f3f46" roughness={0.92} />
      </mesh>

      {/* Broken boards / crates */}
      <mesh
        position={[-0.15, 0.42, 0.05]}
        rotation={[0.08, scraped ? 0.05 : 0.45, 0.04]}
        castShadow
      >
        <boxGeometry args={scraped ? [2.1, 0.22, 0.85] : [1.7, 0.24, 1.05]} />
        <meshStandardMaterial color="#57534e" roughness={0.88} />
      </mesh>
      <mesh
        position={[0.55, 0.28, -0.45]}
        rotation={[0.05, 0.85, 0.03]}
        castShadow
      >
        <boxGeometry args={[1.35, 0.18, 0.8]} />
        <meshStandardMaterial color="#d6d3d1" roughness={0.95} />
      </mesh>
      <mesh
        position={[-0.65, 0.26, 0.4]}
        rotation={[0.04, -0.65, 0.05]}
        castShadow
      >
        <boxGeometry args={[1.1, 0.16, 0.65]} />
        <meshStandardMaterial color="#78716c" roughness={0.93} />
      </mesh>

      {pieces.map((piece, index) => (
        <group
          key={index}
          position={[piece.x, piece.y, piece.z]}
          rotation={[
            Math.PI / 2 + 0.1 * (index % 2),
            piece.yaw,
            0.15 * ((index % 3) - 1),
          ]}
        >
          {piece.kind === 0 ? (
            <mesh castShadow>
              <cylinderGeometry args={[0.16, 0.18, 0.72, 12]} />
              <meshStandardMaterial
                color={piece.color}
                metalness={0.55}
                roughness={0.35}
              />
            </mesh>
          ) : piece.kind === 1 ? (
            <mesh castShadow>
              <boxGeometry args={[0.55, 0.38, 0.42]} />
              <meshStandardMaterial color={piece.color} roughness={0.7} />
            </mesh>
          ) : (
            <mesh castShadow rotation={[0.2, 0.4, 0.1]}>
              <sphereGeometry args={[0.28, 10, 8]} />
              <meshStandardMaterial color={piece.color} roughness={0.55} />
            </mesh>
          )}
          {index % 2 === 0 ? (
            <mesh position={[0.18, 0, 0.04]} rotation={[0, 0.25, 0.08]}>
              <planeGeometry args={[0.72, 0.5]} />
              <meshStandardMaterial
                color="#f8fafc"
                roughness={0.95}
                side={THREE.DoubleSide}
              />
            </mesh>
          ) : null}
        </group>
      ))}
    </group>
  );
}

function FloodCollectionLoad({ fill }: { fill: number }) {
  if (fill <= 0.02) return null;
  const count = Math.max(4, Math.ceil(fill * 14));
  return (
    <group position={[0, 0.1, 0]}>
      {Array.from({ length: count }, (_, index) => {
        const angle = index * 2.15;
        const radius = 0.45 + (index % 4) * 0.32;
        return (
          <group
            key={index}
            position={[
              Math.cos(angle) * radius,
              0.16 + Math.floor(index / 4) * 0.28,
              Math.sin(angle) * radius,
            ]}
            rotation={[0.15, angle, 0.1 * (index % 2)]}
          >
            <mesh castShadow>
              <sphereGeometry args={[0.48, 10, 8]} />
              <meshStandardMaterial
                color={index % 2 ? "#334155" : "#4b5563"}
                roughness={0.94}
              />
            </mesh>
            <mesh position={[0.22, 0.2, 0.1]} rotation={[0.25, 0.6, 0.15]}>
              <cylinderGeometry args={[0.1, 0.12, 0.48, 10]} />
              <meshStandardMaterial
                color={index % 3 ? "#f59e0b" : "#e5e7eb"}
                metalness={0.5}
                roughness={0.35}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function floodLabelText(
  zone: FloodRecoveryZone,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  const respawnEtaSec = getFloodZoneRespawnEtaSec(zone);
  if (respawnEtaSec > 0) {
    return t("floodZoneRespawn", {
      time: formatDumpTruckReturnTime(respawnEtaSec),
    });
  }
  if (zone.phase === "readyToBurn") return t("floodLeaveIncinerator");
  if (zone.phase === "burning") return t("floodZone");
  if (zone.active) {
    return t("floodZoneFill", {
      current: zone.incineratorUnits,
      capacity: zone.incineratorCapacity,
    });
  }
  return t("floodZone");
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
    zone.debrisRespawnAt ?? "",
    Math.floor(zone.burnProgress * 20),
    zone.debris
      .map(
        (d) =>
          `${d.id}:${d.active ? 1 : 0}:${Math.floor(d.remaining)}:${d.cleaved ? 1 : 0}`,
      )
      .join(","),
  ].join("|");
}

function FloodDebrisPiles({
  terrainRef,
  visible,
}: {
  terrainRef: React.MutableRefObject<TerrainData>;
  visible: boolean;
}) {
  const groupRefs = useRef(new Map<string, THREE.Group>());
  const membershipRef = useRef("");
  const [, setRev] = useState(0);

  useFrame(() => {
    const zone = terrainRef.current.floodZone;
    if (!zone || !visible) return;
    const terrain = terrainRef.current;

    for (const d of zone.debris) {
      const group = groupRefs.current.get(d.id);
      if (!group) continue;
      const live = d.active && d.remaining > 0;
      group.visible = live;
      if (!live) continue;
      const y = sampleHeight(terrain, d.x, d.z);
      // Keep piles tall enough to read from the cockpit; scraped windrows
      // stretch sideways along the blade while staying chunky.
      const scale = 1.35 + Math.min(1, d.remaining / 180) * 0.7;
      const scraped = !!d.yaw || !!d.cleaved;
      group.position.set(d.x, y + 0.03, d.z);
      group.rotation.set(0, d.yaw ?? group.rotation.y, 0);
      group.scale.set(
        scraped ? scale * 1.45 : scale,
        scale * (scraped ? 0.95 : 1.05),
        scraped ? scale * 0.95 : scale,
      );
    }

    const membership = zone.debris
      .filter((d) => d.active && d.remaining > 0)
      .map((d) => `${d.id}:${d.cleaved ? 1 : 0}:${Math.floor(d.remaining / 40)}`)
      .join("|");
    if (membership !== membershipRef.current) {
      membershipRef.current = membership;
      setRev((v) => v + 1);
    }
  });

  if (!visible) return null;
  const zone = terrainRef.current.floodZone;
  if (!zone) return null;

  return (
    <>
      {zone.debris
        .filter((d) => d.active && d.remaining > 0)
        .map((d, index) => {
          const y = sampleHeight(terrainRef.current, d.x, d.z);
          const scale = 1.35 + Math.min(1, d.remaining / 180) * 0.7;
          const scraped = !!d.yaw || !!d.cleaved;
          return (
            <group
              key={d.id}
              ref={(node) => {
                if (node) groupRefs.current.set(d.id, node);
                else groupRefs.current.delete(d.id);
              }}
              position={[d.x, y + 0.03, d.z]}
              rotation={[0, d.yaw ?? index * 0.7, 0]}
              scale={[
                scraped ? scale * 1.45 : scale,
                scale * (scraped ? 0.95 : 1.05),
                scraped ? scale * 0.95 : scale,
              ]}
            >
              <FloodTrashPile
                amount={d.remaining}
                variant={index}
                scraped={scraped}
              />
            </group>
          );
        })}
    </>
  );
}

export function FloodRecoveryDecor({
  terrainRef,
  showZonePaint = true,
}: {
  terrainRef: React.MutableRefObject<TerrainData>;
  showZonePaint?: boolean;
}) {
  const t = useTranslations("yanmar.scene");
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
      const next = floodLabelText(zone, t);
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
  const showRespawnPaint = getFloodZoneRespawnEtaSec(zone) > 0;
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
      {(showActive || showRespawnPaint) && showZonePaint ? (
        <group position={[zone.centerX, groundY + GROUND_PAINT_LIFT, zone.centerZ]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
            <circleGeometry args={[zone.radius * 0.62, 48]} />
            <meshBasicMaterial color="#0ea5e9" opacity={0.18} {...GROUND_PAINT_MATERIAL} />
          </mesh>
          <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
            <ringGeometry args={[zone.radius * 0.62 - 0.35, zone.radius * 0.62 + 0.15, 64]} />
            <meshBasicMaterial color="#38bdf8" opacity={0.88} {...GROUND_PAINT_MATERIAL} />
          </mesh>
          <Text
            font={YANMAR_SCENE_FONT}
            ref={labelRef}
            position={[0, 0.006, -zone.radius * 0.62 - 1.2]}
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
            {floodLabelText(zone, t)}
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
          {/* Blade transfer accepts a little past the painted pad rim. */}
          {collectionPct < 1 ? (
            <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry
                args={[
                  zone.collectionRadius + FLOOD_COLLECTION_ACCEPT_MARGIN - 0.18,
                  zone.collectionRadius + FLOOD_COLLECTION_ACCEPT_MARGIN,
                  48,
                ]}
              />
              <meshStandardMaterial
                color="#38bdf8"
                emissive="#0ea5e9"
                emissiveIntensity={0.25}
                transparent
                opacity={0.55}
              />
            </mesh>
          ) : null}
          {/* Grab range hugs the pile — pad rim is only for blade collection. */}
          {collectionPct >= 1 ? (
            <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry
                args={[
                  FLOOD_COLLECTION_GRAB_RADIUS - 0.22,
                  FLOOD_COLLECTION_GRAB_RADIUS,
                  36,
                ]}
              />
              <meshStandardMaterial
                color="#4ade80"
                emissive="#166534"
                emissiveIntensity={0.55}
                transparent
                opacity={0.9}
              />
            </mesh>
          ) : null}
          {collectionPct > 0.02 ? (
            <FloodCollectionLoad fill={collectionPct} />
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
            {t("floodCollection", {
              current: Math.floor(zone.collectedUnits),
              capacity: FLOOD_COLLECTION_THRESHOLD,
            })}
          </Text>
        </group>
      ) : null}

      {/* Debris piles — positions follow the blade every frame while scraped. */}
      <FloodDebrisPiles terrainRef={terrainRef} visible={showActive} />

      {/* Incinerator — NE map corner, hopper open toward the debris field. */}
      <group
        position={[zone.incineratorX, incineratorY, zone.incineratorZ]}
        rotation={[0, zone.incineratorYaw ?? 0, 0]}
      >
        {/* Open-top hopper: load it from above just like a truck bed. */}
        <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
          <boxGeometry args={[6.5, 0.5, 5.2]} />
          <meshStandardMaterial color="#27272a" metalness={0.5} roughness={0.42} />
        </mesh>
        <mesh position={[-3.0, 1.65, 0]} castShadow>
          <boxGeometry args={[0.5, 2.8, 5.2]} />
          <meshStandardMaterial color="#3f3f46" metalness={0.45} roughness={0.4} />
        </mesh>
        <mesh position={[3.0, 1.65, 0]} castShadow>
          <boxGeometry args={[0.5, 2.8, 5.2]} />
          <meshStandardMaterial color="#3f3f46" metalness={0.45} roughness={0.4} />
        </mesh>
        <mesh position={[0, 1.65, -2.35]} castShadow>
          <boxGeometry args={[5.5, 2.8, 0.5]} />
          <meshStandardMaterial color="#3f3f46" metalness={0.45} roughness={0.4} />
        </mesh>
        <mesh position={[0, 3.05, -2.35]} castShadow>
          <boxGeometry args={[6.5, 0.24, 0.3]} />
          <meshStandardMaterial color="#171717" metalness={0.65} roughness={0.32} />
        </mesh>
        <mesh position={[-3.0, 3.05, 0]} castShadow>
          <boxGeometry args={[0.3, 0.24, 5.2]} />
          <meshStandardMaterial color="#171717" metalness={0.65} roughness={0.32} />
        </mesh>
        <mesh position={[3.0, 3.05, 0]} castShadow>
          <boxGeometry args={[0.3, 0.24, 5.2]} />
          <meshStandardMaterial color="#171717" metalness={0.65} roughness={0.32} />
        </mesh>
        {/* Chimney */}
        <mesh position={[1.8, 5.2, -1.2]} castShadow>
          <cylinderGeometry args={[0.55, 0.7, 3.6, 12]} />
          <meshStandardMaterial color="#52525b" metalness={0.55} roughness={0.35} />
        </mesh>
        {/* Fold-down front gate keeps the top and front clear for loading. */}
        <mesh
          position={[0, 0.7, 2.35]}
          rotation={[
            zone.phase === "burning" || zone.phase === "readyToBurn" ? -0.05 : 1.42,
            0,
            0,
          ]}
          castShadow
        >
          <boxGeometry args={[3.2, 1.8, 0.18]} />
          <meshStandardMaterial color="#b45309" metalness={0.4} roughness={0.45} />
        </mesh>
        {incineratorPct > 0.02 ? (
          <group position={[0, 0.58, -0.1]}>
            {Array.from({ length: Math.max(3, Math.ceil(incineratorPct * 16)) }, (_, index) => {
              const angle = index * 2.4;
              const radius = 0.45 + (index % 3) * 0.4;
              return (
                <group
                  key={index}
                  position={[
                    Math.cos(angle) * radius,
                    Math.floor(index / 5) * 0.22,
                    Math.sin(angle) * radius,
                  ]}
                  rotation={[0.12, angle, 0.08]}
                >
                  <mesh castShadow>
                    <sphereGeometry args={[0.3, 8, 7]} />
                    <meshStandardMaterial color={index % 2 ? "#3f4c5d" : "#565f68"} roughness={0.95} />
                  </mesh>
                  <mesh position={[0.14, 0.15, 0.07]} rotation={[0.2, 0.5, 0]}>
                    <cylinderGeometry args={[0.055, 0.065, 0.28, 8]} />
                    <meshStandardMaterial color="#facc15" metalness={0.45} roughness={0.4} />
                  </mesh>
                </group>
              );
            })}
          </group>
        ) : null}
        {/* Fill level window */}
        <mesh position={[-2.2, 1.5, 0]} castShadow>
          <boxGeometry args={[0.15, 2.0, 2.4]} />
          <meshStandardMaterial color="#18181b" />
        </mesh>
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
        {zone.phase === "burning" ? (
          <Text
            font={YANMAR_SCENE_FONT}
            position={[0, 8.4, 0]}
            rotation={[0, zone.incineratorYaw, 0]}
            fontSize={1.4}
            color="#fed7aa"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.07}
            outlineColor="#7c2d12"
          >
            {t("floodBurning", {
              percent: Math.round(zone.burnProgress * 100),
            })}
          </Text>
        ) : null}
        <Text
          font={YANMAR_SCENE_FONT}
          position={[0, 0.1, 4.2]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={1.05}
          color="#fef3c7"
          outlineWidth={0.05}
          outlineColor="#111827"
        >
          {t("floodIncinerator", {
            current: Math.floor(zone.incineratorUnits),
            capacity: zone.incineratorCapacity,
          })}
        </Text>
      </group>
    </group>
  );
}
