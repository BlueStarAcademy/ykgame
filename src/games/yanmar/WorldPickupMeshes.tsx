"use client";

import { useMemo, useRef, useState, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldPickup, WorldPickupsState } from "./worldPickups";

const STAR_SPIN = 1.35;
const BOOST_SPIN = 1.55;
const BOB_AMP = 0.12;
const BOB_SPEED = 2.4;

function createStarShape() {
  const shape = new THREE.Shape();
  const spikes = 5;
  const outer = 0.55;
  const inner = 0.24;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    // Tip points up (+Y). sin(+π/2)=1 → first outer tip at (0, +r).
    const a = (i / (spikes * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  geo.center();
  // Keep in XY (vertical). Do not rotate onto the ground plane.
  return geo;
}

function StarMesh() {
  const geo = useMemo(() => createStarShape(), []);
  return (
    <group>
      <mesh geometry={geo} castShadow>
        <meshStandardMaterial
          color="#ffd24a"
          emissive="#c99612"
          emissiveIntensity={0.55}
          metalness={0.35}
          roughness={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0, 0]} scale={0.38}>
        <octahedronGeometry args={[0.35, 0]} />
        <meshStandardMaterial
          color="#fff6c8"
          emissive="#ffcc44"
          emissiveIntensity={0.35}
          metalness={0.2}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}

function BoosterMesh() {
  // Cylinder/cone default axis is +Y — keep upright (standing rocket).
  return (
    <group>
      <mesh castShadow position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 0.72, 10]} />
        <meshStandardMaterial
          color="#2a9d8f"
          emissive="#1a5c55"
          emissiveIntensity={0.35}
          metalness={0.45}
          roughness={0.32}
        />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <coneGeometry args={[0.18, 0.28, 8]} />
        <meshStandardMaterial color="#e9f5f3" metalness={0.5} roughness={0.28} />
      </mesh>
      <mesh position={[0, -0.42, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.32, 0.38, 8]} />
        <meshStandardMaterial
          color="#ff7a3d"
          emissive="#ff4d00"
          emissiveIntensity={0.7}
          metalness={0.15}
          roughness={0.45}
        />
      </mesh>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.3, 0.05, Math.sin(a) * 0.3]}
            rotation={[0, -a, 0]}
          >
            <boxGeometry args={[0.06, 0.28, 0.14]} />
            <meshStandardMaterial color="#1d6f66" metalness={0.4} roughness={0.35} />
          </mesh>
        );
      })}
    </group>
  );
}

function PickupInstance({ pickup }: { pickup: WorldPickup }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const spin = pickup.kind === "star" ? STAR_SPIN : BOOST_SPIN;
    g.rotation.y += spin * delta;
    const bob =
      Math.sin(performance.now() * 0.001 * BOB_SPEED + pickup.spawnedAt * 0.001) *
      BOB_AMP;
    g.position.set(pickup.x, pickup.y + bob, pickup.z);
  });

  return (
    <group ref={groupRef} position={[pickup.x, pickup.y, pickup.z]}>
      {pickup.kind === "star" ? <StarMesh /> : <BoosterMesh />}
    </group>
  );
}

/**
 * Renders active world pickups. Syncs from the sim ref inside the R3F tree so
 * spawns are not lost if a parent React revision update is delayed/skipped.
 */
export function WorldPickupMeshes({
  pickupsRef,
}: {
  pickupsRef: RefObject<WorldPickupsState | null>;
  /** @deprecated kept for call-site compatibility; sync is revision-driven from the ref. */
  revision?: number;
}) {
  const [active, setActive] = useState<WorldPickup[]>([]);
  const lastRevisionRef = useRef(-1);

  useFrame(() => {
    const state = pickupsRef.current;
    if (!state) {
      if (lastRevisionRef.current !== -1) {
        lastRevisionRef.current = -1;
        setActive([]);
      }
      return;
    }
    if (state.revision === lastRevisionRef.current) return;
    lastRevisionRef.current = state.revision;
    setActive(state.active.slice());
  });

  return (
    <group>
      {active.map((pickup) => (
        <PickupInstance key={pickup.id} pickup={pickup} />
      ))}
    </group>
  );
}
