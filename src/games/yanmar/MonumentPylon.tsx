"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo } from "react";
import { Billboard, Text } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { YK_GEONGI_LOGO } from "@/lib/brand-assets";
import { MONUMENT_SIGN } from "./monument/catalog";
import type { MonumentPhase } from "./monument/types";

const PANEL = "#f2f0ea";
const PANEL_EDGE = "#d4d0c6";
const POLE = "#8a9098";
const YANMAR_RED = "#e30613";
const SCAFFOLD = "#c4a035";

/** 월드 스케일 — 시인성·접근 안내를 위해 기존 대비 확대 */
const MONUMENT_SCALE = 1.45;

/** 세로 얀마 마크 텍스처 비율 (보드 안 맞춤) */
const YANMAR_MARK_ASPECT = 0.72;

function configureDecalTexture(texture: THREE.Texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.premultiplyAlpha = false;
  texture.needsUpdate = true;
}

/**
 * 굴착기 차체와 동일한 쉐브론 작법으로 세로 얀마 마크를 그린다.
 * (사진 PNG를 그대로 붙이지 않음 — 배경·왜곡 없이 브랜드만)
 */
function createYanmarVerticalMarkTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;

  const w = 720;
  const h = 1000;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = YANMAR_RED;

  const drawSolidChevron = (x: number, y: number, cw: number, ch: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + cw * 0.5, y + ch);
    ctx.lineTo(x + cw, y);
    ctx.lineTo(x + cw * 0.78, y);
    ctx.lineTo(x + cw * 0.5, y + ch * 0.55);
    ctx.lineTo(x + cw * 0.22, y);
    ctx.closePath();
    ctx.fill();
  };

  /** 아래 쉐브론: 좌·우 대칭 막대, 중심 틈 — 양옆 두께 동일 */
  const drawSplitChevron = (x: number, y: number, cw: number, ch: number) => {
    const cx = x + cw * 0.5;
    const gap = cw * 0.06;
    const topInset = cw * 0.22;
    const innerTipY = y + ch * 0.55;
    const outerTipY = y + ch;

    const drawArm = (side: -1 | 1) => {
      const topOuterX = side < 0 ? x : x + cw;
      const topInnerX = side < 0 ? x + topInset : x + cw - topInset;
      const cutX = cx + side * (gap * 0.5);

      // 외곽·내곽 선을 따라 cutX까지 보간 → 수직 절단면에서 두께 보존
      const tOuter = (cutX - topOuterX) / (cx - topOuterX);
      const tInner = (cutX - topInnerX) / (cx - topInnerX);
      const cutOuterY = y + tOuter * (outerTipY - y);
      const cutInnerY = y + tInner * (innerTipY - y);

      ctx.beginPath();
      ctx.moveTo(topOuterX, y);
      ctx.lineTo(topInnerX, y);
      ctx.lineTo(cutX, cutInnerY);
      ctx.lineTo(cutX, cutOuterY);
      ctx.closePath();
      ctx.fill();
    };

    drawArm(-1);
    drawArm(1);
  };

  const markW = 640;
  const markX = (w - markW) / 2;
  const topChevronH = 255;
  const botChevronH = 215;
  const botChevronOffset = 185; // 위 쉐브론 top 기준, 아래 쉐브론 top
  const fontSize = 148;
  const textGap = 72; // 아래 쉐브론 끝 → 텍스트 상단
  const chevronBlockH = botChevronOffset + botChevronH;
  const blockH = chevronBlockH + textGap + fontSize;
  const originY = (h - blockH) / 2;

  // 위: 이어진 V / 아래: 꼭짓점만 갈라진 V — 블록 전체를 세로 중앙
  drawSolidChevron(markX, originY, markW, topChevronH);
  drawSplitChevron(markX, originY + botChevronOffset, markW, botChevronH);

  ctx.font = `900 ${fontSize}px Arial, "Helvetica Neue", "Noto Sans KR", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    "YANMAR",
    w / 2,
    originY + chevronBlockH + textGap + fontSize / 2,
  );

  const texture = new THREE.CanvasTexture(canvas);
  configureDecalTexture(texture);
  return texture;
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
  const yanmarMap = useMemo(() => createYanmarVerticalMarkTexture(), []);

  useEffect(() => {
    return () => {
      yanmarMap?.dispose();
    };
  }, [yanmarMap]);

  const yanmarH = 2.85;
  const yanmarW = yanmarH * YANMAR_MARK_ASPECT;

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

      {/* bottom board — drawn Yanmar mark (not photo PNG) */}
      <mesh position={[0, 5.1, 0]} castShadow frustumCulled={false}>
        <boxGeometry args={[3.4, 3.2, 0.55]} />
        <meshStandardMaterial color={PANEL} roughness={0.75} />
      </mesh>
      <mesh position={[0, 5.1, 0.29]} frustumCulled={false}>
        <boxGeometry args={[3.15, 2.95, 0.04]} />
        <meshStandardMaterial color="#faf8f4" roughness={0.88} />
      </mesh>
      {yanmarMap ? (
        <SignDecal
          map={yanmarMap}
          width={yanmarW}
          height={yanmarH}
          position={[0, 5.1, 0.34]}
        />
      ) : null}

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

      <mesh position={[0, 6.65, 0]} frustumCulled={false}>
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
