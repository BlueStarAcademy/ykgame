"use client";

import { Billboard, Text } from "@react-three/drei";
import { MONUMENT_SIGN } from "./monument/catalog";
import type { MonumentPhase } from "./monument/types";

const PANEL = "#f2f0ea";
const PANEL_EDGE = "#d4d0c6";
const POLE = "#8a9098";
const YANMAR_RED = "#e30613";
const SCAFFOLD = "#c4a035";

function CompletedPylon() {
  return (
    <group>
      {/* pole */}
      <mesh position={[0, 3.2, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.34, 6.4, 12]} />
        <meshStandardMaterial color={POLE} metalness={0.45} roughness={0.4} />
      </mesh>
      {/* concrete base */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[1.4, 0.4, 1.4]} />
        <meshStandardMaterial color="#9aa0a6" roughness={0.9} />
      </mesh>

      {/* bottom board */}
      <mesh position={[0, 5.1, 0]} castShadow>
        <boxGeometry args={[3.4, 3.2, 0.55]} />
        <meshStandardMaterial color={PANEL} roughness={0.75} />
      </mesh>
      <mesh position={[0, 5.1, 0.29]}>
        <boxGeometry args={[3.15, 2.95, 0.04]} />
        <meshStandardMaterial color="#faf8f4" roughness={0.85} />
      </mesh>
      {/* chevron mark (two stacked V) */}
      <mesh position={[0, 5.55, 0.32]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.55, 0.55, 3]} />
        <meshStandardMaterial color={YANMAR_RED} roughness={0.5} />
      </mesh>
      <mesh position={[0, 5.05, 0.32]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.55, 0.55, 3]} />
        <meshStandardMaterial color={YANMAR_RED} roughness={0.5} />
      </mesh>
      <Billboard position={[0, 4.15, 0.4]} follow lockX={false} lockZ={false}>
        <Text
          fontSize={0.38}
          color={YANMAR_RED}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#ffffff"
          fontWeight={800}
        >
          YANMAR
        </Text>
      </Billboard>

      {/* top board */}
      <mesh position={[0, 7.35, 0]} castShadow>
        <boxGeometry args={[2.6, 1.15, 0.5]} />
        <meshStandardMaterial color={PANEL} roughness={0.75} />
      </mesh>
      <mesh position={[0, 7.35, 0.27]}>
        <boxGeometry args={[2.4, 0.95, 0.04]} />
        <meshStandardMaterial color="#faf8f4" roughness={0.85} />
      </mesh>
      <Billboard position={[0, 7.35, 0.4]} follow lockX={false} lockZ={false}>
        <Text
          fontSize={0.36}
          color={YANMAR_RED}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.025}
          outlineColor="#ffffff"
        >
          YK 건기
        </Text>
      </Billboard>
      {/* edge trim */}
      <mesh position={[0, 6.65, 0]}>
        <boxGeometry args={[3.5, 0.08, 0.58]} />
        <meshStandardMaterial color={PANEL_EDGE} roughness={0.6} />
      </mesh>
      <mesh position={[0, 8.0, 0]}>
        <boxGeometry args={[2.7, 0.08, 0.52]} />
        <meshStandardMaterial color={PANEL_EDGE} roughness={0.6} />
      </mesh>
    </group>
  );
}

function BuildingScaffold() {
  return (
    <group>
      <mesh position={[0, 2.5, 0]} castShadow>
        <boxGeometry args={[3.6, 5.0, 1.2]} />
        <meshStandardMaterial
          color="#d6d2c8"
          roughness={0.95}
          transparent
          opacity={0.55}
        />
      </mesh>
      {/* scaffolding poles */}
      {[
        [-1.6, -0.5],
        [1.6, -0.5],
        [-1.6, 0.5],
        [1.6, 0.5],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 2.6, z]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 5.2, 8]} />
          <meshStandardMaterial color={SCAFFOLD} metalness={0.3} roughness={0.5} />
        </mesh>
      ))}
      {[1.2, 2.6, 4.0].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[3.4, 0.1, 1.1]} />
          <meshStandardMaterial color={SCAFFOLD} roughness={0.55} />
        </mesh>
      ))}
      <Billboard position={[0, 5.6, 0]} follow lockX={false} lockZ={false}>
        <Text
          fontSize={0.4}
          color="#92400e"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.03}
          outlineColor="#fef3c7"
        >
          건설중
        </Text>
      </Billboard>
    </group>
  );
}

function QuestMarker() {
  return (
    <group>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[2.2, 2.4, 0.3, 24]} />
        <meshStandardMaterial color="#6b7280" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.25, 2.2, 10]} />
        <meshStandardMaterial color={POLE} metalness={0.4} roughness={0.45} />
      </mesh>
      <Billboard position={[0, 2.8, 0]} follow lockX={false} lockZ={false}>
        <Text
          fontSize={0.36}
          color="#0033a0"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.025}
          outlineColor="#ffffff"
        >
          YK 조형물 예정지
        </Text>
      </Billboard>
    </group>
  );
}

export function MonumentPylon({
  phase,
  starsStored = 0,
}: {
  phase: MonumentPhase;
  starsStored?: number;
}) {
  if (phase === "locked") return null;

  const { x, z, rotationY } = MONUMENT_SIGN;

  return (
    <group position={[x, 0, z]} rotation={[0, rotationY, 0]}>
      {phase === "quest" ? <QuestMarker /> : null}
      {phase === "building" || phase === "claimable" ? (
        <BuildingScaffold />
      ) : null}
      {phase === "active" ? <CompletedPylon /> : null}
      {phase === "claimable" ? (
        <Billboard position={[0, 6.2, 0]} follow lockX={false} lockZ={false}>
          <Text
            fontSize={0.42}
            color="#16a34a"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.03}
            outlineColor="#052e16"
          >
            건설완료 가능
          </Text>
        </Billboard>
      ) : null}
      {phase === "active" && starsStored > 0 ? (
        <Billboard position={[0, 9.0, 0]} follow lockX={false} lockZ={false}>
          <Text
            fontSize={0.4}
            color="#fbbf24"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.03}
            outlineColor="#422006"
          >
            {`★ ${starsStored}`}
          </Text>
        </Billboard>
      ) : null}
    </group>
  );
}
