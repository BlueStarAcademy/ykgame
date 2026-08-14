"use client";

import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { YANMAR_SCENE_FONT } from "./troikaTextSetup";
import * as THREE from "three";
import { SPORTS_MEET_PORTAL } from "./sportsMeet/coursePickups";

const GATE_HALF = 3.4;
const POST_H = 5.2;
const BEAM_Y = POST_H + 0.15;
const TICKET_ICON = "/images/yanmar/2d/sports-meet-ticket.svg";

function createCheckeredTexture(cols: number, rows: number) {
  if (typeof document === "undefined") return null;
  const cell = 16;
  const canvas = document.createElement("canvas");
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#0f172a" : "#f8fafc";
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function createStripeTexture() {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const bands = 10;
  const bandH = canvas.height / bands;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#dc2626" : "#f8fafc";
    ctx.fillRect(0, i * bandH, canvas.width, bandH + 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function RacingPost({ x }: { x: number }) {
  const stripe = useMemo(() => createStripeTexture(), []);
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <cylinderGeometry args={[0.55, 0.62, 0.24, 12]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.25} />
      </mesh>
      <mesh position={[0, POST_H * 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.32, POST_H, 12]} />
        {stripe ? (
          <meshStandardMaterial
            map={stripe}
            roughness={0.55}
            metalness={0.15}
          />
        ) : (
          <meshStandardMaterial color="#dc2626" roughness={0.55} />
        )}
      </mesh>
      <mesh position={[0, POST_H + 0.12, 0]} castShadow>
        <sphereGeometry args={[0.22, 12, 10]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#b45309"
          emissiveIntensity={0.35}
          metalness={0.55}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

function CheckeredBanner() {
  const bannerRef = useRef<THREE.Mesh>(null);
  const checkered = useMemo(() => createCheckeredTexture(10, 4), []);

  useFrame(({ clock }) => {
    const mesh = bannerRef.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    mesh.rotation.x = Math.sin(t * 1.4) * 0.04;
    mesh.position.y = BEAM_Y - 1.05 + Math.sin(t * 1.7) * 0.03;
  });

  return (
    <mesh ref={bannerRef} position={[0, BEAM_Y - 1.05, 0.08]} castShadow>
      <planeGeometry args={[GATE_HALF * 1.85, 1.7]} />
      {checkered ? (
        <meshStandardMaterial
          map={checkered}
          roughness={0.85}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      ) : (
        <meshStandardMaterial
          color="#111827"
          roughness={0.85}
          side={THREE.DoubleSide}
        />
      )}
    </mesh>
  );
}

function TicketCountPlaque({
  remaining,
  limit,
}: {
  remaining: number;
  limit: number;
}) {
  const ticketTexture = useLoader(THREE.TextureLoader, TICKET_ICON);
  useLayoutEffect(() => {
    ticketTexture.colorSpace = THREE.SRGBColorSpace;
    ticketTexture.anisotropy = 8;
    ticketTexture.needsUpdate = true;
  }, [ticketTexture]);

  return (
    <group position={[0, BEAM_Y + 0.55, 0]}>
      <mesh position={[0, 0, 0.05]} castShadow>
        <boxGeometry args={[2.55, 0.78, 0.12]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={[-0.62, 0, 0.13]}>
        <planeGeometry args={[0.58, 0.58]} />
        <meshStandardMaterial
          map={ticketTexture}
          transparent
          roughness={0.55}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Text
        font={YANMAR_SCENE_FONT}
        position={[0.38, 0, 0.13]}
        fontSize={0.38}
        color="#fef3c7"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.022}
        outlineColor="#0f172a"
      >
        {`(${remaining}/${limit})`}
      </Text>
    </group>
  );
}

/** Racing finish-line gate for the sports-meet entrance. */
export function SportsMeetPortal({
  visible = true,
  ticketRemaining = 1,
  ticketLimit = 1,
}: {
  visible?: boolean;
  ticketRemaining?: number;
  ticketLimit?: number;
}) {
  const groundCheck = useMemo(() => createCheckeredTexture(12, 2), []);
  if (!visible) return null;
  const { x, z, rotationY } = SPORTS_MEET_PORTAL;

  return (
    <group position={[x, 0, z]} rotation={[0, rotationY, 0]}>
      <RacingPost x={-GATE_HALF} />
      <RacingPost x={GATE_HALF} />

      {/* Top crossbeam */}
      <mesh position={[0, BEAM_Y, 0]} castShadow>
        <boxGeometry args={[GATE_HALF * 2 + 0.9, 0.28, 0.36]} />
        <meshStandardMaterial color="#1e293b" roughness={0.45} metalness={0.4} />
      </mesh>
      <mesh position={[0, BEAM_Y + 0.22, 0]} castShadow>
        <boxGeometry args={[GATE_HALF * 2 + 0.6, 0.14, 0.22]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.55} metalness={0.2} />
      </mesh>

      {/* Hanging ropes */}
      {([-2.2, -0.75, 0.75, 2.2] as const).map((lx) => (
        <mesh key={lx} position={[lx, BEAM_Y - 0.45, 0.05]}>
          <cylinderGeometry args={[0.025, 0.025, 0.9, 6]} />
          <meshStandardMaterial color="#334155" roughness={0.8} />
        </mesh>
      ))}

      <CheckeredBanner />

      <Suspense fallback={null}>
        <TicketCountPlaque remaining={ticketRemaining} limit={ticketLimit} />
      </Suspense>

      {/* Title plaque */}
      <mesh position={[0, BEAM_Y + 1.15, 0]} castShadow>
        <boxGeometry args={[4.2, 0.55, 0.1]} />
        <meshStandardMaterial color="#1e3a5f" roughness={0.55} />
      </mesh>
      <Text
        font={YANMAR_SCENE_FONT}
        position={[0, BEAM_Y + 1.15, 0.08]}
        fontSize={0.28}
        color="#fef3c7"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.018}
        outlineColor="#0f172a"
      >
        굴착기 운동회
      </Text>

      {/* Ground finish stripe */}
      <mesh
        position={[0, 0.03, 0.9]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[GATE_HALF * 2.15, 1.35]} />
        {groundCheck ? (
          <meshStandardMaterial map={groundCheck} roughness={0.95} />
        ) : (
          <meshStandardMaterial color="#111827" roughness={0.95} />
        )}
      </mesh>

      {/* Approach lane markers */}
      {([-1.6, 1.6] as const).map((lx) => (
        <mesh
          key={`lane-${lx}`}
          position={[lx, 0.04, 2.4]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[0.28, 2.2]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}
