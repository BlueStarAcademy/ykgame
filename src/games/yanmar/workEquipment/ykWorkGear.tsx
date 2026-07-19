"use client";

/**
 * Work gear — true unibody via extruded silhouettes (reference gooseneck).
 * Boom kink is one continuous side face — no stacked plates / slice wrinkles.
 */

import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import {
  getArmCylRodLocal,
  getBoomPinAnchors,
  getBucketCylMeetLocal,
  getGooseneckGeometry,
  WE,
} from "./workEquipmentStructure";
import { YANMAR_MACHINE_COLORS } from "../machineVisualTheme";

/** Match chassis + mark backdrop (YK / YANMAR sit on this paint). */
const RED = YANMAR_MACHINE_COLORS.paintRed;
const RED_DARK = YANMAR_MACHINE_COLORS.paintRedDark;
const CHROME = YANMAR_MACHINE_COLORS.chrome;
const BARREL = YANMAR_MACHINE_COLORS.frame;

/** Solid section — slightly stout, with a dark silhouette rim. */
const BOOM_H = 0.34;
const BOOM_D = 0.28;
const ARM_H = 0.3;
const ARM_D = 0.26;
/** Outline lip (reference-style edge reinforcement). */
const RIM = 0.02;

function Paint({ dark = false }: { dark?: boolean }) {
  return (
    <meshStandardMaterial
      color={dark ? RED_DARK : RED}
      roughness={dark ? 0.38 : 0.24}
      metalness={dark ? 0.2 : 0.24}
    />
  );
}

type SpinePt = { x: number; y: number; tx: number; ty: number };

/** Centerline with a circular fillet at the kink — one smooth spine. */
function sampleGooseneckSpine(boomLen: number, filletR: number): SpinePt[] {
  const g = getGooseneckGeometry(boomLen);
  const a0 = g.lowerAngle;
  const a1 = g.upperAngle;
  const turn = a1 - a0;
  const half = Math.max(0.08, Math.abs(turn) * 0.5);
  const dist = filletR * Math.tan(half);
  const d0x = Math.cos(a0);
  const d0y = Math.sin(a0);
  const d1x = Math.cos(a1);
  const d1y = Math.sin(a1);
  const p0 = { x: g.kink.x - d0x * dist, y: g.kink.y - d0y * dist };
  const p1 = { x: g.kink.x + d1x * dist, y: g.kink.y + d1y * dist };
  const sign = turn < 0 ? 1 : -1;
  const cx = p0.x + sign * Math.sin(a0) * filletR;
  const cy = p0.y + sign * -Math.cos(a0) * filletR;

  const out: SpinePt[] = [];
  const lowerN = 10;
  for (let i = 0; i <= lowerN; i++) {
    const t = i / lowerN;
    out.push({ x: p0.x * t, y: p0.y * t, tx: d0x, ty: d0y });
  }
  const arcN = 20;
  for (let i = 1; i <= arcN; i++) {
    const t = i / arcN;
    const ang = a0 + turn * t;
    const tx = Math.cos(ang);
    const ty = Math.sin(ang);
    out.push({
      x: cx - sign * Math.sin(ang) * filletR,
      y: cy - sign * -Math.cos(ang) * filletR,
      tx,
      ty,
    });
  }
  const upperN = 10;
  for (let i = 1; i <= upperN; i++) {
    const t = i / upperN;
    out.push({
      x: p1.x + (boomLen - p1.x) * t,
      y: p1.y + (0 - p1.y) * t,
      tx: d1x,
      ty: d1y,
    });
  }
  return out;
}

/** Extruded gooseneck — continuous fillet + rounded arm-pivot tip (no plates). */
function createGooseneckGeometry(boomLen: number, beamH: number, depth: number) {
  const filletR = 0.42;
  const spine = sampleGooseneckSpine(boomLen, filletR);
  const h = beamH * 0.5;
  const left = spine.map((s) => ({
    x: s.x - s.ty * h,
    y: s.y + s.tx * h,
  }));
  const right = spine.map((s) => ({
    x: s.x + s.ty * h,
    y: s.y - s.tx * h,
  }));

  /** Semicircle tip at arm pivot — reads as molded ear, not a cut bar. */
  const tip = spine[spine.length - 1]!;
  const tipN = 14;
  const tipArc: { x: number; y: number }[] = [];
  for (let i = 0; i <= tipN; i++) {
    const ang = Math.PI / 2 - (i / tipN) * Math.PI;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const vx = c * tip.tx + s * -tip.ty;
    const vy = c * tip.ty + s * tip.tx;
    tipArc.push({ x: tip.x + vx * h, y: tip.y + vy * h });
  }

  const shape = new THREE.Shape();
  shape.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < left.length - 1; i++) shape.lineTo(left[i].x, left[i].y);
  for (const p of tipArc) shape.lineTo(p.x, p.y);
  for (let i = right.length - 2; i >= 0; i--) shape.lineTo(right[i].x, right[i].y);
  shape.closePath();

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.014,
    bevelSegments: 3,
    curveSegments: 1,
  });
  geom.translate(0, 0, -depth * 0.5);
  return geom;
}

/** Side brand decal — transparent mark only (no backing plaque / fake background). */
function SideLogo({
  x,
  y,
  z,
  width,
  height,
  logo,
  flip,
}: {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  logo: THREE.Texture;
  flip?: boolean;
}) {
  return (
    <mesh
      position={[x, y, z]}
      rotation={[0, flip ? Math.PI : 0, 0]}
      renderOrder={40}
      frustumCulled={false}
    >
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={logo}
        transparent
        alphaTest={0.08}
        toneMapped={false}
        depthTest
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-6}
        polygonOffsetUnits={-6}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}

export function YkPin({
  x,
  y,
  radius = 0.14,
  width = 0.46,
  /** Link pivots: plain steel, no chrome end-caps (keeps arm tip uncluttered). */
  plain = false,
}: {
  x: number;
  y: number;
  radius?: number;
  width?: number;
  plain?: boolean;
}) {
  return (
    <group position={[x, y, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[radius, radius, width, plain ? 16 : 28]} />
        <meshStandardMaterial
          color={plain ? "#3a4450" : "#b4bec8"}
          roughness={plain ? 0.4 : 0.2}
          metalness={plain ? 0.45 : 0.78}
        />
      </mesh>
      {!plain
        ? ([-1, 1] as const).map((side) => (
            <mesh
              key={side}
              position={[0, 0, side * (width / 2 + 0.01)]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[radius * 0.78, radius * 0.78, 0.038, 22]} />
              <meshStandardMaterial color={CHROME} roughness={0.12} metalness={0.92} />
            </mesh>
          ))
        : null}
    </group>
  );
}

export const WorkLinkPin = YkPin;

/**
 * Boom–arm pivot pin — bolt faces on both sides, plus upper/lower
 * spool-style retainers so the joint reads locked top and bottom.
 */
export function YkScrewJointPin({
  x = 0,
  y = 0,
  radius = 0.09,
  width = 0.32,
}: {
  x?: number;
  y?: number;
  radius?: number;
  width?: number;
}) {
  const half = width / 2;
  const retainerR = radius * 0.42;
  const retainerY = radius * 1.15;
  return (
    <group position={[x, y, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[radius * 0.62, radius * 0.62, width * 0.9, 20]} />
        <meshStandardMaterial color="#8a949e" roughness={0.28} metalness={0.75} />
      </mesh>
      {([-1, 1] as const).map((side) => (
        <group key={side} position={[0, 0, side * half]}>
          {/* Main pin face (실타래 나사 머리) */}
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[radius, radius, 0.034, 24]} />
            <meshStandardMaterial color="#d0d8e0" roughness={0.16} metalness={0.88} />
          </mesh>
          <mesh position={[0, 0, side * 0.018]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[radius * 0.38, radius * 0.38, 0.016, 16]} />
            <meshStandardMaterial color="#5a636c" roughness={0.3} metalness={0.7} />
          </mesh>
          {/* Upper + lower retainers — bottom pair gives the joint weight */}
          {([-1, 1] as const).map((vert) => (
            <group key={vert} position={[0, vert * retainerY, side * 0.01]}>
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[retainerR, retainerR, 0.028, 18]} />
                <meshStandardMaterial color="#d0d8e0" roughness={0.16} metalness={0.88} />
              </mesh>
              <mesh
                position={[0, 0, side * 0.014]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <cylinderGeometry
                  args={[retainerR * 0.4, retainerR * 0.4, 0.014, 12]}
                />
                <meshStandardMaterial color="#5a636c" roughness={0.3} metalness={0.7} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Tiny pin ears — flush with arm section, not bolted side plates. */
export function YkMount({ x, y, width = 0.18 }: { x: number; y: number; width?: number }) {
  return (
    <group position={[x, y, 0]}>
      {([-1, 1] as const).map((side) => (
        <mesh key={side} position={[0.01, 0.02, side * (width / 2)]} castShadow>
          <boxGeometry args={[0.08, 0.06, 0.022]} />
          <Paint />
        </mesh>
      ))}
    </group>
  );
}

export const HydraulicMountBracket = YkMount;

/**
 * Reference gooseneck: one extruded silhouette — smooth outer bend, no plates.
 */
export function YkBoom({
  length,
  logo,
  logoWidth = 0.95,
  logoHeight = 0.22,
}: {
  length: number;
  height?: number;
  sideDepth?: number;
  logo?: THREE.Texture;
  logoWidth?: number;
  logoHeight?: number;
}) {
  const g = getGooseneckGeometry(length);
  const { body, rim } = useMemo(() => {
    const body = createGooseneckGeometry(length, BOOM_H, BOOM_D);
    const rim = createGooseneckGeometry(
      length,
      BOOM_H + RIM * 2,
      BOOM_D + RIM * 1.2,
    );
    return { body, rim };
  }, [length]);
  useEffect(
    () => () => {
      body.dispose();
      rim.dispose();
    },
    [body, rim],
  );

  const aspect = logoWidth / Math.max(logoHeight, 1e-6);
  const maxH = BOOM_H * 0.42;
  const maxW = g.lowerLen * 0.5;
  let fitH = Math.min(logoHeight, maxH);
  let fitW = fitH * aspect;
  if (fitW > maxW) {
    fitW = maxW;
    fitH = fitW / aspect;
  }
  /** Logo on lower leg face, just below the 45° kink. */
  const logoT = 0.88;
  const logoX = g.kink.x * logoT;
  const logoY = g.kink.y * logoT;
  const rimD = BOOM_D + RIM * 1.2;
  const logoZ = rimD * 0.5 + 0.02;

  return (
    <group>
      {/* Dark silhouette rim — edge reinforcement */}
      <mesh geometry={rim} castShadow>
        <Paint dark />
      </mesh>
      <mesh geometry={body} castShadow receiveShadow>
        <Paint />
      </mesh>
      {logo ? (
        <group position={[logoX, logoY, 0]} rotation={[0, 0, g.lowerAngle]}>
          <SideLogo
            x={0}
            y={0}
            z={logoZ}
            width={fitW}
            height={fitH}
            logo={logo}
          />
          <SideLogo
            x={0}
            y={0}
            z={-logoZ}
            width={fitW}
            height={fitH}
            logo={logo}
            flip
          />
        </group>
      ) : null}
    </group>
  );
}

/** Bend is built into {@link YkBoom} — no separate cover part. */
export function YkBoomKinkCover(_props: { boomLen: number }) {
  return null;
}

/**
 * Straight solid arm — same unibody language as the boom.
 * Root end is a short rounded nose (same section), not a bolted cover.
 */
export function YkArm({
  length,
  logo,
  logoWidth,
  logoHeight,
  logoX,
}: {
  length: number;
  height?: number;
  sideDepth?: number;
  logo?: THREE.Texture;
  logoWidth?: number;
  logoHeight?: number;
  logoX?: number;
}) {
  const lx = logoX ?? length * 0.45;
  const rimD = ARM_D + RIM * 1.2;
  const z = rimD * 0.5 + 0.02;
  const rootR = Math.min(0.05, ARM_H * 0.18);

  return (
    <group>
      {/* Dark edge rim */}
      <RoundedBox
        args={[length + RIM * 0.6, ARM_H + RIM * 2, ARM_D + RIM * 1.2]}
        radius={rootR}
        smoothness={4}
        position={[length * 0.5, 0, 0]}
        castShadow
      >
        <Paint dark />
      </RoundedBox>
      <RoundedBox
        args={[length, ARM_H, ARM_D]}
        radius={rootR}
        smoothness={4}
        position={[length * 0.5, 0, 0]}
        castShadow
        receiveShadow
      >
        <Paint />
      </RoundedBox>
      {/* Root nose toward boom pivot — same section, molded into the arm */}
      <RoundedBox
        args={[0.2, ARM_H + RIM * 1.4, ARM_D + RIM]}
        radius={rootR}
        smoothness={4}
        position={[-0.02, 0, 0]}
        castShadow
      >
        <Paint dark />
      </RoundedBox>
      <RoundedBox
        args={[0.18, ARM_H, ARM_D]}
        radius={rootR}
        smoothness={4}
        position={[-0.02, 0, 0]}
        castShadow
      >
        <Paint />
      </RoundedBox>
      {logo && logoWidth != null && logoHeight != null ? (
        <>
          <SideLogo
            x={lx}
            y={0}
            z={z}
            width={logoWidth}
            height={logoHeight}
            logo={logo}
          />
          <SideLogo
            x={lx}
            y={0}
            z={-z}
            width={logoWidth}
            height={logoHeight}
            logo={logo}
            flip
          />
        </>
      ) : null}
    </group>
  );
}

/**
 * Short hydraulic jumper under the joint — tucked to the arm 등, not a cover.
 */
export function YkArmJointCover() {
  const boomEnd = getArmCylRodLocal();
  const armStart = getBucketCylMeetLocal();
  const mid = {
    x: (boomEnd.x + armStart.x) / 2,
    y: (boomEnd.y + armStart.y) / 2 + 0.02,
  };
  const pipeLen =
    Math.hypot(armStart.x - boomEnd.x, armStart.y - boomEnd.y) * 0.72 || 0.12;
  const pipeAng = Math.atan2(armStart.y - boomEnd.y, armStart.x - boomEnd.x);

  return (
    <group position={[mid.x, mid.y, 0]} rotation={[0, 0, pipeAng]}>
      <mesh rotation={[0, 0, -Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.009, 0.009, pipeLen, 8]} />
        <meshStandardMaterial color="#050708" roughness={0.78} metalness={0.15} />
      </mesh>
      {([-1, 1] as const).map((end) => (
        <mesh
          key={end}
          position={[end * (pipeLen * 0.42), 0, 0]}
          rotation={[0, 0, -Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.014, 0.014, 0.018, 8]} />
          <meshStandardMaterial color="#c8d0d8" roughness={0.2} metalness={0.88} />
        </mesh>
      ))}
    </group>
  );
}

/** @deprecated use YkArmJointCover — kept for shim export name. */
export function YkClevis(_props: { boomLen?: number; height?: number; sideDepth?: number }) {
  return <YkArmJointCover />;
}

function Eye({ compact = false }: { compact?: boolean }) {
  const shellR = compact ? 0.042 : 0.07;
  const pinR = compact ? 0.02 : 0.034;
  const shellW = compact ? 0.07 : 0.1;
  const pinW = compact ? 0.16 : 0.25;
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[shellR, shellR, shellW, 16]} />
        <meshStandardMaterial color="#12171d" roughness={0.3} metalness={0.48} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[pinR, pinR, pinW, 14]} />
        <meshStandardMaterial color={CHROME} roughness={0.12} metalness={0.92} />
      </mesh>
    </group>
  );
}

/**
 * Work-equipment hydraulic cylinder.
 * `detail="full"` — boom/arm (hoses + bands + eye ends).
 * `detail="clean"` — one-piece lift unit: barrel + rod + tiny pins (no dual eyes).
 */
export function YkCylinder({
  barrelLength,
  initialDistance,
  controlRef,
  detail = "full",
  radius = 0.074,
}: {
  barrelLength: number;
  initialDistance: number;
  controlRef: MutableRefObject<THREE.Group | null>;
  detail?: "full" | "clean";
  radius?: number;
}) {
  const root = useRef<THREE.Group>(null);
  const rod = useRef<THREE.Mesh>(null);
  const eye = useRef<THREE.Group>(null);
  const clean = detail === "clean";
  const rear = clean ? 0.02 : 0.08;
  const front = rear + barrelLength;
  const mid = (rear + front) / 2;
  const r = radius;

  const hoses = useMemo(() => {
    if (clean) return [] as THREE.CatmullRomCurve3[];
    const y = r + 0.012;
    const mk = (z: number) =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(rear + 0.1, y, z),
        new THREE.Vector3(mid, y + 0.02, z),
        new THREE.Vector3(front - 0.08, y, z),
      ]);
    return [mk(0.05), mk(-0.05)];
  }, [clean, front, mid, r, rear]);

  useFrame(() => {
    const pin = Math.max(
      front + (clean ? 0.06 : 0.12),
      Number(root.current?.userData.pinDistance ?? initialDistance),
    );
    const len = Math.max(0.05, pin - front - (clean ? 0.03 : 0.06));
    if (rod.current) {
      rod.current.position.x = front + len / 2;
      rod.current.scale.y = len;
    }
    if (eye.current) eye.current.position.x = pin;
  });

  const capR = clean ? r : 0.09;
  const rodR = clean ? 0.018 : 0.03;

  return (
    <group
      ref={(n) => {
        root.current = n;
        controlRef.current = n;
      }}
    >
      {/* Single barrel body */}
      <mesh position={[mid, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
        <cylinderGeometry args={[r, r, barrelLength, clean ? 16 : 22]} />
        <meshStandardMaterial color={BARREL} roughness={0.28} metalness={0.4} />
      </mesh>
      {!clean ? (
        <>
          <mesh position={[rear + 0.03, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
            <cylinderGeometry args={[capR, capR, 0.08, 14]} />
            <meshStandardMaterial color="#252c34" roughness={0.26} metalness={0.5} />
          </mesh>
          <mesh position={[front, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
            <cylinderGeometry args={[capR, capR, 0.09, 14]} />
            <meshStandardMaterial color="#252c34" roughness={0.26} metalness={0.5} />
          </mesh>
          {[0.32, 0.68].map((t) => (
            <mesh
              key={t}
              position={[rear + barrelLength * t, 0, 0]}
              rotation={[0, 0, -Math.PI / 2]}
            >
              <cylinderGeometry args={[r + 0.007, r + 0.007, 0.024, 12]} />
              <meshStandardMaterial color="#c8d0d8" roughness={0.2} metalness={0.78} />
            </mesh>
          ))}
        </>
      ) : (
        /* Soft nose on barrel — same radius so it doesn't read as a 2nd cylinder */
        <mesh position={[front - 0.01, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
          <cylinderGeometry args={[r * 0.92, r, 0.04, 14]} />
          <meshStandardMaterial color="#1e252c" roughness={0.3} metalness={0.45} />
        </mesh>
      )}
      {hoses.map((c, i) => (
        <mesh key={i}>
          <tubeGeometry args={[c, 18, 0.012, 5, false]} />
          <meshStandardMaterial color="#050708" roughness={0.75} />
        </mesh>
      ))}
      <mesh ref={rod} position={[front, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
        <cylinderGeometry args={[rodR, rodR, 1, 12]} />
        <meshStandardMaterial color={CHROME} roughness={0.1} metalness={0.95} />
      </mesh>
      {clean ? (
        <>
          {/* Barrel-end pin only — rod tip stays hidden inside BoomLiftRodCover */}
          <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.016, 0.016, 0.11, 10]} />
            <meshStandardMaterial color={CHROME} roughness={0.14} metalness={0.9} />
          </mesh>
          <group ref={eye} position={[initialDistance, 0, 0]} visible={false} />
        </>
      ) : (
        <>
          <Eye />
          <group ref={eye} position={[initialDistance, 0, 0]}>
            <Eye />
          </group>
        </>
      )}
    </group>
  );
}

export const HydraulicCylinder = YkCylinder;

export function ArmTipCoupler() {
  const p2 = WE.couplerPin2;
  return (
    <group>
      <YkPin x={0} y={0} radius={0.15} width={0.5} />
      {([-1, 1] as const).map((side) => (
        <RoundedBox
          key={side}
          args={[0.36, 0.26, 0.04]}
          radius={0.04}
          smoothness={3}
          position={[p2.x * 0.45, p2.y * 0.35, side * 0.25]}
          castShadow
        >
          <Paint dark />
        </RoundedBox>
      ))}
      <YkPin x={p2.x} y={p2.y} radius={0.1} width={0.54} />
    </group>
  );
}

export function BoomHydraulicMounts({ boomLen }: { boomLen: number }) {
  const a = getBoomPinAnchors(boomLen);
  return (
    <group>
      {/* Arm/boom dorsal cylinder rear only — lift tip hides in YkBoomKinkCover */}
      <group
        position={[a.armCylBarrel.x, a.armCylBarrel.y, 0]}
        rotation={[0, 0, a.upperAngle]}
      >
        {([-1, 1] as const).map((side) => (
          <mesh key={side} position={[0, 0.008, side * 0.09]} castShadow>
            <boxGeometry args={[0.09, 0.06, 0.022]} />
            <Paint dark />
          </mesh>
        ))}
        <WorkLinkPin x={0} y={0} radius={0.04} width={0.2} plain />
      </group>
    </group>
  );
}

/** Rod pin is built into YkArmJointCover — keep export so scene imports stay valid. */
export function ArmCylinderRodMount(_props: { boomLen: number }) {
  return null;
}

export const ReferenceBoom = YkBoom;
export const ReferenceArm = YkArm;
export const BoomArmClevis = YkArmJointCover;
export const BoomKinkCover = YkBoomKinkCover;
export const BoomArmScrewPin = YkScrewJointPin;
