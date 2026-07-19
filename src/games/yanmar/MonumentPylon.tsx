"use client";

import { Suspense, useLayoutEffect } from "react";
import { Billboard, Text } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { YANMAR_MARK_LOGO, YK_GEONGI_LOGO } from "@/lib/brand-assets";
import { MONUMENT_SIGN } from "./monument/catalog";
import type { MonumentPhase } from "./monument/types";

const PANEL = "#f2f0ea";
const PANEL_EDGE = "#d4d0c6";
const POLE = "#8a9098";
const SCAFFOLD = "#c4a035";

/** 월드 스케일 — 시인성·접근 안내를 위해 기존 대비 확대 */
const MONUMENT_SCALE = 1.45;

function configureDecalTexture(texture: THREE.Texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.premultiplyAlpha = false;
  texture.needsUpdate = true;
}

function MonumentLabel({
  position,
  fontSize,
  color,
  outlineColor,
  children,
}: {
  position: [number, number, number];
  fontSize: number;
  color: string;
  outlineColor: string;
  children: string;
}) {
  return (
    <Billboard
      position={position}
      follow
      lockX={false}
      lockZ={false}
      frustumCulled={false}
    >
      <Text
        fontSize={fontSize}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={fontSize * 0.06}
        outlineColor={outlineColor}
        maxWidth={8}
        textAlign="center"
        whiteSpace="nowrap"
        overflowWrap="normal"
        depthOffset={-4}
        renderOrder={20}
        frustumCulled={false}
      >
        {children}
      </Text>
    </Billboard>
  );
}

function SignDecal({
  map,
  width,
  height,
  position,
}: {
  map: THREE.Texture;
  width: number;
  height: number;
  position: [number, number, number];
}) {
  return (
    <mesh position={position} frustumCulled={false} renderOrder={5}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={map}
        transparent
        alphaTest={0.08}
        toneMapped={false}
        depthWrite={false}
      />
    </mesh>
  );
}

/** 공식 YANMAR 마크 (제공 파일, 검정 배경 제거) */
function YanmarMarkDecal() {
  const mark = useLoader(THREE.TextureLoader, YANMAR_MARK_LOGO.src);

  useLayoutEffect(() => {
    configureDecalTexture(mark);
  }, [mark]);

  const markW = 2.9;
  const markH = markW / YANMAR_MARK_LOGO.aspect;

  return (
    <SignDecal map={mark} width={markW} height={markH} position={[0, 5.1, 0.34]} />
  );
}

/** 공식 YK건기 투명 워드마크 (정비소·차체와 동일 에셋) */
function YkGeongiDecal() {
  const ykLogo = useLoader(THREE.TextureLoader, YK_GEONGI_LOGO.black);

  useLayoutEffect(() => {
    configureDecalTexture(ykLogo);
  }, [ykLogo]);

  const ykW = 2.15;
  const ykH = ykW / YK_GEONGI_LOGO.aspect;

  return (
    <SignDecal map={ykLogo} width={ykW} height={ykH} position={[0, 7.35, 0.32]} />
  );
}

function CompletedPylon() {
  return (
    <group>
      <mesh position={[0, 3.2, 0]} castShadow frustumCulled={false}>
        <cylinderGeometry args={[0.28, 0.34, 6.4, 12]} />
        <meshStandardMaterial color={POLE} metalness={0.45} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.2, 0]} castShadow frustumCulled={false}>
        <boxGeometry args={[1.4, 0.4, 1.4]} />
        <meshStandardMaterial color="#9aa0a6" roughness={0.9} />
      </mesh>

      {/* bottom board — official YANMAR mark file */}
      <mesh position={[0, 5.1, 0]} castShadow frustumCulled={false}>
        <boxGeometry args={[3.4, 2.7, 0.55]} />
        <meshStandardMaterial color={PANEL} roughness={0.75} />
      </mesh>
      <mesh position={[0, 5.1, 0.29]} frustumCulled={false}>
        <boxGeometry args={[3.15, 2.45, 0.04]} />
        <meshStandardMaterial color="#faf8f4" roughness={0.88} />
      </mesh>
      <Suspense fallback={null}>
        <YanmarMarkDecal />
      </Suspense>

      {/* top board — official YK건기 wordmark */}
      <mesh position={[0, 7.35, 0]} castShadow frustumCulled={false}>
        <boxGeometry args={[2.6, 1.15, 0.5]} />
        <meshStandardMaterial color={PANEL} roughness={0.75} />
      </mesh>
      <mesh position={[0, 7.35, 0.27]} frustumCulled={false}>
        <boxGeometry args={[2.4, 0.95, 0.04]} />
        <meshStandardMaterial color="#faf8f4" roughness={0.88} />
      </mesh>
      <Suspense fallback={null}>
        <YkGeongiDecal />
      </Suspense>

      <mesh position={[0, 6.45, 0]} frustumCulled={false}>
        <boxGeometry args={[3.5, 0.08, 0.58]} />
        <meshStandardMaterial color={PANEL_EDGE} roughness={0.6} />
      </mesh>
      <mesh position={[0, 8.0, 0]} frustumCulled={false}>
        <boxGeometry args={[2.7, 0.08, 0.52]} />
        <meshStandardMaterial color={PANEL_EDGE} roughness={0.6} />
      </mesh>
    </group>
  );
}

function BuildingScaffold() {
  return (
    <group>
      <mesh position={[0, 2.5, 0]} castShadow frustumCulled={false}>
        <boxGeometry args={[3.6, 5.0, 1.2]} />
        <meshStandardMaterial
          color="#d6d2c8"
          roughness={0.95}
          transparent
          opacity={0.55}
        />
      </mesh>
      {[
        [-1.6, -0.5],
        [1.6, -0.5],
        [-1.6, 0.5],
        [1.6, 0.5],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 2.6, z]} castShadow frustumCulled={false}>
          <cylinderGeometry args={[0.08, 0.08, 5.2, 8]} />
          <meshStandardMaterial color={SCAFFOLD} metalness={0.3} roughness={0.5} />
        </mesh>
      ))}
      {[1.2, 2.6, 4.0].map((y) => (
        <mesh key={y} position={[0, y, 0]} frustumCulled={false}>
          <boxGeometry args={[3.4, 0.1, 1.1]} />
          <meshStandardMaterial color={SCAFFOLD} roughness={0.55} />
        </mesh>
      ))}
      <MonumentLabel
        position={[0, 5.6, 0.2]}
        fontSize={0.44}
        color="#92400e"
        outlineColor="#fef3c7"
      >
        건설중
      </MonumentLabel>
    </group>
  );
}

function QuestMarker() {
  return (
    <group>
      <mesh position={[0, 0.15, 0]} frustumCulled={false}>
        <cylinderGeometry args={[2.2, 2.4, 0.3, 24]} />
        <meshStandardMaterial color="#6b7280" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.2, 0]} castShadow frustumCulled={false}>
        <cylinderGeometry args={[0.2, 0.25, 2.2, 10]} />
        <meshStandardMaterial color={POLE} metalness={0.4} roughness={0.45} />
      </mesh>
      <MonumentLabel
        position={[0, 2.8, 0.2]}
        fontSize={0.4}
        color="#0033a0"
        outlineColor="#ffffff"
      >
        YK 조형물 예정지
      </MonumentLabel>
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
    <group
      position={[x, 0, z]}
      rotation={[0, rotationY, 0]}
      scale={MONUMENT_SCALE}
      frustumCulled={false}
    >
      {phase === "quest" ? <QuestMarker /> : null}
      {phase === "building" || phase === "claimable" ? (
        <BuildingScaffold />
      ) : null}
      {phase === "active" ? <CompletedPylon /> : null}
      {phase === "claimable" ? (
        <MonumentLabel
          position={[0, 6.2, 0.2]}
          fontSize={0.46}
          color="#16a34a"
          outlineColor="#052e16"
        >
          건설완료 가능
        </MonumentLabel>
      ) : null}
      {phase === "active" && starsStored > 0 ? (
        <MonumentLabel
          position={[0, 9.2, 0.2]}
          fontSize={0.46}
          color="#fbbf24"
          outlineColor="#422006"
        >
          {`★ ${starsStored}`}
        </MonumentLabel>
      ) : null}
    </group>
  );
}
