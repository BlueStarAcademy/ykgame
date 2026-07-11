"use client";

import { Outlines, Text } from "@react-three/drei";
import { HaulTruckModel } from "./HaulTruckModel";
import type { HillBoulder, HillZone, TerrainData } from "./terrain";
import { sampleHeight } from "./terrain";
import { hillBoulderVisualScale } from "./terrain";

function PremiumBoulder({
  rock,
  index,
  terrain,
  showOutline,
}: {
  rock: HillBoulder;
  index: number;
  terrain: TerrainData;
  showOutline: boolean;
}) {
  const scale = hillBoulderVisualScale(rock.size);
  const detail = rock.roundness >= 0.5 ? 1 : 0;
  return (
    <group
      position={[rock.x, sampleHeight(terrain, rock.x, rock.z) + scale * 0.55, rock.z]}
      rotation={[(index % 3) * 0.14, index * 1.71, (index % 4) * 0.1]}
      scale={[scale * 1.16, scale * 0.82, scale]}
    >
      <mesh castShadow receiveShadow>
        <icosahedronGeometry args={[1, detail]} />
        <meshStandardMaterial color={index % 3 ? "#697078" : "#596168"} roughness={0.96} />
        {showOutline ? <Outlines thickness={0.06} color="#38bdf8" /> : null}
      </mesh>
      <mesh position={[0.16, 0.46, 0.58]} scale={[0.55, 0.13, 0.35]}>
        <sphereGeometry args={[0.5, 10, 6]} />
        <meshStandardMaterial color="#899079" roughness={1} />
      </mesh>
    </group>
  );
}

export function HillZoneDecor({
  zone,
  terrain,
  showGrappleOutlines = false,
}: {
  zone: HillZone;
  terrain: TerrainData;
  showGrappleOutlines?: boolean;
}) {
  const topY = sampleHeight(terrain, zone.centerX, zone.centerZ);
  const dropY = sampleHeight(terrain, zone.dropX, zone.dropZ);
  const showQuarry = zone.active;
  return (
    <group>
      {/* Layered rock outcrops make the procedural hill read as a quarry face. */}
      {showQuarry
        ? Array.from({ length: 18 }, (_, index) => {
            const angle = (index / 18) * Math.PI * 2 + 0.25;
            const radius = zone.radius * (0.72 + (index % 3) * 0.08);
            const x = zone.centerX + Math.cos(angle) * radius;
            const z = zone.centerZ + Math.sin(angle) * radius;
            const y = sampleHeight(terrain, x, z);
            return (
              <mesh
                key={`outcrop-${index}`}
                position={[x, y + 0.65, z]}
                rotation={[index * 0.12, -angle, index * 0.08]}
                scale={[1.6 + (index % 3) * 0.5, 0.8 + (index % 4) * 0.22, 1.2]}
                castShadow={index % 2 === 0}
                receiveShadow
              >
                <dodecahedronGeometry args={[1, 0]} />
                <meshStandardMaterial color={index % 2 ? "#6c6860" : "#77746b"} roughness={0.98} />
              </mesh>
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
                showOutline={showGrappleOutlines}
              />
            ))
        : null}

      {/* Reinforced hilltop loading apron. */}
      <group position={[zone.dropX, dropY + 0.06, zone.dropZ]}>
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
        <HaulTruckModel state={zone.haulTruck} rockCount={zone.haulTruck.loadCount} />
        {showQuarry ? (
          <Text
            position={[0, 0.1, -7.4]}
            rotation={[-Math.PI / 2, 0, Math.PI]}
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
