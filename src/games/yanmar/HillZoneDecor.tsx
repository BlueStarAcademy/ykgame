"use client";

import * as THREE from "three";
import { Outlines, Text } from "@react-three/drei";
import { HaulTruckModel } from "./HaulTruckModel";
import type { HillBoulder, HillZone, TerrainData } from "./terrain";
import { getHillZoneRespawnEtaSec, sampleHeight } from "./terrain";
import { hillBoulderVisualScale } from "./terrain";
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

function zoneRingPaintY(
  terrain: TerrainData,
  x: number,
  z: number,
  radius: number,
) {
  const samples = 12;
  const heights: number[] = [];
  const ringR = Math.max(1.2, radius * 0.92);
  for (let i = 0; i < samples; i += 1) {
    const angle = (i / samples) * Math.PI * 2;
    heights.push(
      sampleHeight(
        terrain,
        x + Math.cos(angle) * ringR,
        z + Math.sin(angle) * ringR,
      ),
    );
  }
  heights.sort((a, b) => a - b);
  const median = heights[Math.floor(heights.length / 2)] ?? heights[0] ?? 0;
  return median + GROUND_PAINT_LIFT;
}

function PremiumBoulder({
  rock,
  index,
  terrain,
  showHighlight,
}: {
  rock: HillBoulder;
  index: number;
  terrain: TerrainData;
  showHighlight: boolean;
}) {
  const scale = hillBoulderVisualScale(rock.size);
  const detail = rock.roundness >= 0.5 ? 1 : 0;
  const groundY = sampleHeight(terrain, rock.x, rock.z);
  const markerRadius = Math.max(0.48, scale * 1.15);
  return (
    <group>
      {showHighlight ? (
        <>
          <mesh
            position={[rock.x, groundY + GROUND_PAINT_LIFT, rock.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={0}
          >
            <ringGeometry args={[markerRadius * 0.72, markerRadius, 28]} />
            <meshBasicMaterial color="#38bdf8" opacity={0.85} {...GROUND_PAINT_MATERIAL} />
          </mesh>
          <mesh
            position={[rock.x, groundY + GROUND_PAINT_LIFT + 0.002, rock.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={0}
          >
            <ringGeometry args={[markerRadius * 0.42, markerRadius * 0.58, 24]} />
            <meshBasicMaterial color="#f59e0b" opacity={0.7} {...GROUND_PAINT_MATERIAL} />
          </mesh>
        </>
      ) : null}
      <group
        position={[rock.x, groundY + scale * 0.55, rock.z]}
        rotation={[(index % 3) * 0.14, index * 1.71, (index % 4) * 0.1]}
        scale={[scale * 1.16, scale * 0.82, scale]}
      >
        <mesh castShadow receiveShadow>
          <icosahedronGeometry args={[1, detail]} />
          <meshStandardMaterial
            color={index % 3 ? "#718096" : "#64748b"}
            emissive="#082f49"
            emissiveIntensity={showHighlight ? 0.22 : 0.12}
            roughness={0.58}
            metalness={0.2}
          />
          {showHighlight ? <Outlines thickness={0.08} color="#67e8f9" /> : null}
        </mesh>
        {/* Pale mineral face and metallic veins make each collectible distinct. */}
        <mesh position={[0.18, 0.47, 0.6]} scale={[0.58, 0.12, 0.38]}>
          <sphereGeometry args={[0.5, 12, 8]} />
          <meshStandardMaterial
            color="#cbd5e1"
            emissive="#164e63"
            emissiveIntensity={0.1}
            roughness={0.42}
            metalness={0.32}
          />
        </mesh>
        <mesh
          position={[-0.26, 0.08, 0.91]}
          rotation={[0.08, 0.1, 0.72 + index * 0.19]}
          scale={[0.58, 0.74, 0.18]}
        >
          <torusGeometry args={[0.42, 0.045, 6, 18, Math.PI * 1.25]} />
          <meshStandardMaterial
            color="#d8b45d"
            emissive="#92400e"
            emissiveIntensity={0.22}
            roughness={0.24}
            metalness={0.76}
          />
        </mesh>
        <mesh position={[0.46, -0.14, 0.82]} scale={[0.13, 0.13, 0.08]}>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color="#a5f3fc"
            emissive="#22d3ee"
            emissiveIntensity={0.45}
            roughness={0.16}
            metalness={0.48}
          />
        </mesh>
      </group>
    </group>
  );
}

function StoneZonePaint({ zone, terrain }: { zone: HillZone; terrain: TerrainData }) {
  const radius = zone.radius * 0.55;
  const paintY = zoneRingPaintY(terrain, zone.centerX, zone.centerZ, radius);
  const remaining = zone.boulders.filter(
    (rock) => rock.active && !rock.delivered && !rock.extracted,
  ).length;
  const respawnEtaSec = getHillZoneRespawnEtaSec(zone);
  const label =
    respawnEtaSec > 0
      ? `석재 · 리젠 ${formatDumpTruckReturnTime(respawnEtaSec)}`
      : zone.active
        ? `석재 · ${remaining}`
        : "석재";
  return (
    <group position={[zone.centerX, paintY, zone.centerZ]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
        <circleGeometry args={[radius, 48]} />
        <meshBasicMaterial color="#0ea5e9" opacity={0.16} {...GROUND_PAINT_MATERIAL} />
      </mesh>
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
        <ringGeometry args={[radius - 0.28, radius + 0.12, 64]} />
        <meshBasicMaterial color="#38bdf8" opacity={0.85} {...GROUND_PAINT_MATERIAL} />
      </mesh>
      <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
        <ringGeometry args={[radius - 1.05, radius - 0.78, 64]} />
        <meshBasicMaterial color="#bae6fd" opacity={0.5} {...GROUND_PAINT_MATERIAL} />
      </mesh>
      <Text
        position={[0, 0.006, -radius - 1.15]}
        rotation={[-Math.PI / 2, 0, Math.PI]}
        fontSize={1.55}
        color="#e0f2fe"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.07}
        outlineColor="#0c4a6e"
        renderOrder={0}
        material-depthTest={true}
        material-depthWrite={false}
        material-transparent
        material-polygonOffset
        material-polygonOffsetFactor={-2}
        material-polygonOffsetUnits={-2}
        material-toneMapped={false}
      >
        {label}
      </Text>
    </group>
  );
}

export function HillZoneDecor({
  zone,
  terrain,
  showZonePaint = true,
  highlightBoulders = false,
}: {
  zone: HillZone;
  terrain: TerrainData;
  showZonePaint?: boolean;
  highlightBoulders?: boolean;
}) {
  const topY = sampleHeight(terrain, zone.centerX, zone.centerZ);
  const dropY = sampleHeight(terrain, zone.dropX, zone.dropZ);
  const showQuarry = zone.active;
  const showRespawnPaint = !zone.active && getHillZoneRespawnEtaSec(zone) > 0;
  return (
    <group>
      {(showQuarry || showRespawnPaint) && showZonePaint ? (
        <StoneZonePaint zone={zone} terrain={terrain} />
      ) : null}

      {/* Distant quarry face decor — outside the harvest ring so it is not mistaken for pickups. */}
      {showQuarry
        ? Array.from({ length: 2 }, (_, index) => {
            const angle = (index / 2) * Math.PI * 2 + 0.25;
            const radius = zone.radius * (0.88 + (index % 3) * 0.04);
            const x = zone.centerX + Math.cos(angle) * radius;
            const z = zone.centerZ + Math.sin(angle) * radius;
            const y = sampleHeight(terrain, x, z);
            return (
              <group
                key={`outcrop-${index}`}
                position={[x, y + 0.42, z]}
                rotation={[index * 0.12, -angle, index * 0.08]}
                scale={[1.05 + index * 0.12, 0.58 + index * 0.08, 0.82]}
              >
                <mesh castShadow receiveShadow>
                  <dodecahedronGeometry args={[1, 0]} />
                  <meshStandardMaterial
                    color={index % 2 ? "#475569" : "#526175"}
                    roughness={0.64}
                    metalness={0.18}
                  />
                </mesh>
                <mesh position={[0.18, 0.56, 0.45]} scale={[0.54, 0.1, 0.3]}>
                  <sphereGeometry args={[0.5, 10, 6]} />
                  <meshStandardMaterial
                    color="#cbd5e1"
                    emissive="#155e75"
                    emissiveIntensity={0.1}
                    roughness={0.4}
                    metalness={0.3}
                  />
                </mesh>
                <mesh position={[-0.26, 0.03, 0.87]} rotation={[0, 0.1, 0.5]}>
                  <torusGeometry args={[0.34, 0.04, 6, 16, Math.PI * 1.15]} />
                  <meshStandardMaterial
                    color="#d8b45d"
                    emissive="#78350f"
                    emissiveIntensity={0.16}
                    roughness={0.26}
                    metalness={0.7}
                  />
                </mesh>
              </group>
            );
          })
        : null}
      {showQuarry
        ? zone.boulders
            .filter((rock) => rock.active && !rock.delivered && !rock.extracted)
            .map((rock, index) => (
              <PremiumBoulder
                key={rock.id}
                rock={rock}
                index={index}
                terrain={terrain}
                showHighlight={highlightBoulders}
              />
            ))
        : null}

      {/* Reinforced hilltop loading apron. */}
      <group position={[zone.dropX, dropY, zone.dropZ]}>
        {showQuarry ? (
          <>
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <circleGeometry args={[7.2, 48]} />
              <meshStandardMaterial color="#77756f" roughness={0.93} metalness={0.02} />
            </mesh>
            <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[5.4, 5.65, 48]} />
              <meshStandardMaterial color="#f59e0b" roughness={0.6} />
            </mesh>
          </>
        ) : null}
        <HaulTruckModel state={zone.haulTruck} />
        {showQuarry ? (
          <Text
            position={[0, 0.1, 7.4]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={1.15}
            color="#f8fafc"
            outlineWidth={0.05}
            outlineColor="#111827"
          >
            석재 하역장
          </Text>
        ) : null}
      </group>

      {showQuarry ? (
        <group position={[zone.centerX - 8, topY, zone.centerZ + 7]}>
          <mesh position={[0, 3.5, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.12, 7, 10]} />
            <meshStandardMaterial color="#4b5563" metalness={0.68} roughness={0.34} />
          </mesh>
          {[-0.65, 0.65].map((x) => (
            <mesh key={x} position={[x, 6.7, 0]} rotation={[0.25, 0, 0]}>
              <boxGeometry args={[1.05, 0.5, 0.2]} />
              <meshStandardMaterial color="#e2e8f0" emissive="#fff7d6" emissiveIntensity={0.35} />
            </mesh>
          ))}
        </group>
      ) : null}
    </group>
  );
}
