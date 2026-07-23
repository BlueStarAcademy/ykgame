"use client";

import { Billboard, Text } from "@react-three/drei";
import { SPORTS_MEET_PORTAL } from "./sportsMeet/coursePickups";

export function SportsMeetPortal({ visible = true }: { visible?: boolean }) {
  if (!visible) return null;
  const { x, z, rotationY } = SPORTS_MEET_PORTAL;

  return (
    <group position={[x, 0, z]} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.28, 3.2, 8]} />
        <meshStandardMaterial color="#4a5568" roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[0, 3.4, 0.05]} castShadow>
        <boxGeometry args={[2.8, 1.4, 0.14]} />
        <meshStandardMaterial color="#1e3a5f" roughness={0.55} />
      </mesh>
      <mesh position={[0, 3.4, 0.13]}>
        <boxGeometry args={[2.5, 1.1, 0.03]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.85} />
      </mesh>
      <mesh position={[0, 2.2, 0]}>
        <torusGeometry args={[1.4, 0.08, 8, 24]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#0ea5e9"
          emissiveIntensity={0.45}
          metalness={0.4}
          roughness={0.35}
        />
      </mesh>
      <Billboard position={[0, 4.35, 0]} follow lockX={false} lockZ={false}>
        <Text
          fontSize={0.38}
          color="#0f172a"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.028}
          outlineColor="#fef3c7"
        >
          굴착기 운동회
        </Text>
      </Billboard>
    </group>
  );
}
