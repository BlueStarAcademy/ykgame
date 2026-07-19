"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { YK_GEONGI_LOGO } from "@/lib/brand-assets";
import type { HydraulicVelocity } from "./controls";
import {
  createChassisModelSideBrandTexture,
  createYkGeongiNumberPlateTexture,
  getCarbodyWidth,
  getDozerArmHalfWidth,
  getDozerBladeReach,
  YANMAR_MACHINE_COLORS as COLOR,
  YANMAR_MACHINE_MATERIALS as MATERIAL,
  YANMAR_MACHINE_RIG,
} from "./machineVisualTheme";
import {
  getChassisVisualProfile,
  type ChassisVisualProfile,
  type CanopyVariant,
  type RollbarVariant,
  type IdlerStyle,
  type SprocketStyle,
} from "./chassisVisualConfig";
import type { ChassisModelId } from "./chassisCatalog";

/**
 * Undercarriage / swing-bearing center in body local +X.
 * Tracks are centered here; upper house and work equipment yaw about this axis.
 */
export const SWING_PIVOT_X = YANMAR_MACHINE_RIG.swingPivotX;
export const SWING_HOUSE_LIFT_Y = YANMAR_MACHINE_RIG.swingHouseLiftY;
/** Legacy geometry was authored around track group at -0.72; shift house onto pivot. */
const HOUSE_FROM_LEGACY = 0.72;
/** Carbody deck top → kingpost → house floor (shared by all chassis, including light). */
const SWING_DECK_TOP_Y = 0.76;
const SWING_KINGPOST_H = 0.3;
const SWING_HOUSE_FLOOR_LOCAL_Y =
  SWING_DECK_TOP_Y + SWING_KINGPOST_H + 0.03 - SWING_HOUSE_LIFT_Y;
const TRACK_PAD_COUNT = 34;
const RUBBER_TREAD_COUNT = 48;
const TRACK_STRAIGHT_HALF = 0.86;
const TRACK_LOOP_RADIUS = 0.38;
const TRACK_STRAIGHT_LENGTH = TRACK_STRAIGHT_HALF * 2;
const TRACK_ARC_LENGTH = Math.PI * TRACK_LOOP_RADIUS;
const TRACK_LOOP_LENGTH = TRACK_STRAIGHT_LENGTH * 2 + TRACK_ARC_LENGTH * 2;
const TRACK_WHEEL_DARK = "#14191d";
const TRACK_WHEEL_HUB = "#30373c";
const TRACK_WHEEL_STEEL = "#4a545c";

function getTrackLoopPose(distance: number) {
  let cursor = THREE.MathUtils.euclideanModulo(distance, TRACK_LOOP_LENGTH);

  if (cursor < TRACK_STRAIGHT_LENGTH) {
    return {
      x: -TRACK_STRAIGHT_HALF + cursor,
      y: -TRACK_LOOP_RADIUS,
      angle: 0,
    };
  }
  cursor -= TRACK_STRAIGHT_LENGTH;

  if (cursor < TRACK_ARC_LENGTH) {
    const theta = -Math.PI / 2 + cursor / TRACK_LOOP_RADIUS;
    return {
      x: TRACK_STRAIGHT_HALF + Math.cos(theta) * TRACK_LOOP_RADIUS,
      y: Math.sin(theta) * TRACK_LOOP_RADIUS,
      angle: theta + Math.PI / 2,
    };
  }
  cursor -= TRACK_ARC_LENGTH;

  if (cursor < TRACK_STRAIGHT_LENGTH) {
    return {
      x: TRACK_STRAIGHT_HALF - cursor,
      y: TRACK_LOOP_RADIUS,
      angle: Math.PI,
    };
  }
  cursor -= TRACK_STRAIGHT_LENGTH;

  const theta = Math.PI / 2 + cursor / TRACK_LOOP_RADIUS;
  return {
    x: -TRACK_STRAIGHT_HALF + Math.cos(theta) * TRACK_LOOP_RADIUS,
    y: Math.sin(theta) * TRACK_LOOP_RADIUS,
    angle: theta + Math.PI / 2,
  };
}

function rollerPositions(count: number): number[] {
  if (count <= 1) return [0];
  const span = TRACK_STRAIGHT_HALF * 1.55;
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return -span / 2 + t * span;
  });
}

/** Front idler — large smooth disc (rubber) or rimmed (steel). */
function TrackIdler({
  style,
  side,
  wheelRef,
}: {
  style: IdlerStyle;
  side: 1 | -1;
  wheelRef: (node: THREE.Group | null) => void;
}) {
  const radius = style === "smooth" ? 0.36 : 0.34;
  return (
    <group
      ref={wheelRef}
      position={[TRACK_STRAIGHT_HALF, 0.01, side * 0.28]}
    >
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[radius, radius, 0.18, 32]} />
        <meshStandardMaterial
          color={style === "smooth" ? TRACK_WHEEL_DARK : TRACK_WHEEL_STEEL}
          {...MATERIAL.frame}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.22, 20]} />
        <meshStandardMaterial color={TRACK_WHEEL_HUB} {...MATERIAL.steel} />
      </mesh>
      {style === "rim" ? (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.28, 0.035, 8, 28]} />
          <meshStandardMaterial color={COLOR.steel} {...MATERIAL.steel} />
        </mesh>
      ) : (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 0.04, 28]} />
          <meshStandardMaterial color={COLOR.rubberHighlight} {...MATERIAL.rubber} />
        </mesh>
      )}
    </group>
  );
}

/** Rear drive sprocket — mini hub teeth (rubber) or large steel teeth. */
function TrackSprocket({
  style,
  side,
  wheelRef,
}: {
  style: SprocketStyle;
  side: 1 | -1;
  wheelRef: (node: THREE.Group | null) => void;
}) {
  const isMini = style === "miniHub";
  const radius = isMini ? 0.28 : 0.36;
  const toothCount = isMini ? 8 : 12;
  const toothR = isMini ? 0.24 : 0.31;
  return (
    <group
      ref={wheelRef}
      position={[-TRACK_STRAIGHT_HALF, 0.01, side * 0.28]}
    >
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[radius, radius, isMini ? 0.14 : 0.18, 28]} />
        <meshStandardMaterial
          color={isMini ? TRACK_WHEEL_DARK : TRACK_WHEEL_STEEL}
          {...MATERIAL.frame}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[isMini ? 0.12 : 0.15, isMini ? 0.12 : 0.15, 0.2, 18]} />
        <meshStandardMaterial color={TRACK_WHEEL_HUB} {...MATERIAL.steel} />
      </mesh>
      {Array.from({ length: toothCount }, (_, tooth) => {
        const angle = (tooth / toothCount) * Math.PI * 2;
        return (
          <mesh
            key={tooth}
            position={[Math.cos(angle) * toothR, Math.sin(angle) * toothR, 0]}
            rotation={[0, 0, angle]}
          >
            <boxGeometry
              args={isMini ? [0.08, 0.035, 0.12] : [0.12, 0.05, 0.16]}
            />
            <meshStandardMaterial
              color={isMini ? COLOR.steel : COLOR.trackChain}
              {...MATERIAL.steel}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function TrackRollers({
  count,
  side,
  setWheelRef,
  startIndex,
}: {
  count: number;
  side: 1 | -1;
  setWheelRef: (index: number, node: THREE.Group | null) => void;
  startIndex: number;
}) {
  const xs = rollerPositions(count);
  return (
    <>
      {xs.map((x, index) => (
        <group
          key={`roller-${x}`}
          ref={(node) => setWheelRef(startIndex + index, node)}
          position={[x, -0.1, side * 0.28]}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.155, 0.155, 0.13, 22]} />
            <meshStandardMaterial color={TRACK_WHEEL_DARK} {...MATERIAL.frame} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.16, 16]} />
            <meshStandardMaterial color={TRACK_WHEEL_HUB} {...MATERIAL.steel} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Continuous rubber belt + molded tread (light / medium). */
function RubberTrack({
  side,
  velRef,
  idlerStyle,
  sprocketStyle,
  rollerCount,
}: {
  side: 1 | -1;
  velRef: React.MutableRefObject<HydraulicVelocity>;
  idlerStyle: IdlerStyle;
  sprocketStyle: SprocketStyle;
  rollerCount: number;
}) {
  const wheels = useRef<(THREE.Group | null)[]>([]);
  const outerLugRef = useRef<THREE.InstancedMesh>(null);
  const innerLugRef = useRef<THREE.InstancedMesh>(null);
  const guideLugRef = useRef<THREE.InstancedMesh>(null);
  const trackOffsetRef = useRef(0);
  const lugDummy = useMemo(() => new THREE.Object3D(), []);
  const treadPhases = useMemo(
    () =>
      Array.from(
        { length: RUBBER_TREAD_COUNT },
        (_, index) => (index / RUBBER_TREAD_COUNT) * TRACK_LOOP_LENGTH,
      ),
    [],
  );
  const halfPitch = TRACK_LOOP_LENGTH / (RUBBER_TREAD_COUNT * 2);

  useFrame((_, delta) => {
    const speed = side < 0 ? velRef.current.trackLeft : velRef.current.trackRight;
    trackOffsetRef.current = THREE.MathUtils.euclideanModulo(
      trackOffsetRef.current - speed * delta * 0.82,
      TRACK_LOOP_LENGTH,
    );

    if (Math.abs(speed) >= 0.01) {
      wheels.current.forEach((wheel) => {
        if (wheel) wheel.rotation.z += speed * delta * 2.4;
      });
    }

    const offset = trackOffsetRef.current;

    treadPhases.forEach((phase, index) => {
      const outerPose = getTrackLoopPose(phase + offset);
      const innerPose = getTrackLoopPose(phase + offset + halfPitch);
      const guidePose = getTrackLoopPose(phase + offset);

      const placeLug = (
        pose: ReturnType<typeof getTrackLoopPose>,
        radial: number,
        z: number,
        mesh: THREE.InstancedMesh | null,
        instanceIndex: number,
        scaleX = 1,
        scaleY = 1,
        scaleZ = 1,
      ) => {
        const cos = Math.cos(pose.angle);
        const sin = Math.sin(pose.angle);
        lugDummy.position.set(
          pose.x - sin * radial,
          pose.y + cos * radial,
          z,
        );
        lugDummy.rotation.set(0, 0, pose.angle);
        lugDummy.scale.set(scaleX, scaleY, scaleZ);
        lugDummy.updateMatrix();
        mesh?.setMatrixAt(instanceIndex, lugDummy.matrix);
      };

      placeLug(outerPose, -0.055, side * 0.17, outerLugRef.current, index, 1, 1, 1);
      placeLug(innerPose, -0.055, side * -0.17, innerLugRef.current, index, 1, 1, 1);
      placeLug(guidePose, -0.04, 0, guideLugRef.current, index, 1, 1, 1);
    });

    if (outerLugRef.current) outerLugRef.current.instanceMatrix.needsUpdate = true;
    if (innerLugRef.current) innerLugRef.current.instanceMatrix.needsUpdate = true;
    if (guideLugRef.current) guideLugRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group position={[0, 0.18, side * 0.72]}>
      {/* Continuous rubber belt carcass */}
      <RoundedBox
        args={[2.42, 0.82, 0.6]}
        radius={0.36}
        smoothness={12}
        castShadow
      >
        <meshStandardMaterial
          color={COLOR.rubber}
          roughness={0.88}
          metalness={0.02}
        />
      </RoundedBox>
      {/* Sidewall beads */}
      {[-0.27, 0.27].map((zLocal) => (
        <RoundedBox
          key={`bead-${zLocal}`}
          args={[2.34, 0.12, 0.1]}
          radius={0.05}
          smoothness={6}
          position={[0, 0.08, side * zLocal]}
          castShadow
        >
          <meshStandardMaterial
            color={COLOR.rubberHighlight}
            roughness={0.86}
            metalness={0.03}
          />
        </RoundedBox>
      ))}
      <RoundedBox
        args={[1.65, 0.26, 0.48]}
        radius={0.08}
        smoothness={6}
        position={[0, 0.06, 0]}
        castShadow
      >
        <meshStandardMaterial color={COLOR.frameLight} {...MATERIAL.frame} />
      </RoundedBox>

      <TrackIdler
        style={idlerStyle}
        side={side}
        wheelRef={(node) => {
          wheels.current[0] = node;
        }}
      />
      <TrackSprocket
        style={sprocketStyle}
        side={side}
        wheelRef={(node) => {
          wheels.current[1] = node;
        }}
      />
      <TrackRollers
        count={rollerCount}
        side={side}
        startIndex={2}
        setWheelRef={(index, node) => {
          wheels.current[index] = node;
        }}
      />
      {/* Upper carrier roller */}
      <group position={[0.15, 0.22, side * 0.28]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.12, 16]} />
          <meshStandardMaterial color={TRACK_WHEEL_DARK} {...MATERIAL.frame} />
        </mesh>
      </group>

      {/* Staggered block lugs + center guides (Yanmar brick / L-style) */}
      <instancedMesh
        ref={outerLugRef}
        args={[undefined, undefined, RUBBER_TREAD_COUNT]}
        castShadow
        frustumCulled={false}
      >
        <boxGeometry args={[0.1, 0.082, 0.24]} />
        <meshStandardMaterial
          color={COLOR.rubberHighlight}
          roughness={0.92}
          metalness={0.02}
        />
      </instancedMesh>
      <instancedMesh
        ref={innerLugRef}
        args={[undefined, undefined, RUBBER_TREAD_COUNT]}
        castShadow
        frustumCulled={false}
      >
        <boxGeometry args={[0.1, 0.082, 0.24]} />
        <meshStandardMaterial
          color={COLOR.rubberHighlight}
          roughness={0.92}
          metalness={0.02}
        />
      </instancedMesh>
      <instancedMesh
        ref={guideLugRef}
        args={[undefined, undefined, RUBBER_TREAD_COUNT]}
        castShadow
        frustumCulled={false}
      >
        <boxGeometry args={[0.072, 0.06, 0.11]} />
        <meshStandardMaterial
          color="#1a2228"
          roughness={0.88}
          metalness={0.04}
        />
      </instancedMesh>
    </group>
  );
}

/** Steel link pads + pins (heavy class only). */
function SteelTrack({
  side,
  velRef,
  idlerStyle,
  sprocketStyle,
  rollerCount,
}: {
  side: 1 | -1;
  velRef: React.MutableRefObject<HydraulicVelocity>;
  idlerStyle: IdlerStyle;
  sprocketStyle: SprocketStyle;
  rollerCount: number;
}) {
  const wheels = useRef<(THREE.Group | null)[]>([]);
  const padMeshRef = useRef<THREE.InstancedMesh>(null);
  const guideMeshRef = useRef<THREE.InstancedMesh>(null);
  const pinMeshRef = useRef<THREE.InstancedMesh>(null);
  const trackOffsetRef = useRef(0);
  const padDummy = useMemo(() => new THREE.Object3D(), []);
  const pinDummy = useMemo(() => new THREE.Object3D(), []);
  const padPhases = useMemo(
    () =>
      Array.from(
        { length: TRACK_PAD_COUNT },
        (_, index) => (index / TRACK_PAD_COUNT) * TRACK_LOOP_LENGTH,
      ),
    [],
  );

  useFrame((_, delta) => {
    const speed = side < 0 ? velRef.current.trackLeft : velRef.current.trackRight;
    trackOffsetRef.current = THREE.MathUtils.euclideanModulo(
      trackOffsetRef.current - speed * delta * 0.82,
      TRACK_LOOP_LENGTH,
    );

    if (Math.abs(speed) >= 0.01) {
      wheels.current.forEach((wheel) => {
        if (wheel) wheel.rotation.z += speed * delta * 2.4;
      });
    }

    padPhases.forEach((phase, index) => {
      const pose = getTrackLoopPose(phase + trackOffsetRef.current);
      const cos = Math.cos(pose.angle);
      const sin = Math.sin(pose.angle);

      padDummy.position.set(pose.x, pose.y, 0);
      padDummy.rotation.set(0, 0, pose.angle);
      padDummy.scale.set(1, 1, 1);
      padDummy.updateMatrix();
      padMeshRef.current?.setMatrixAt(index, padDummy.matrix);

      const guideOffset = -0.065;
      padDummy.position.set(
        pose.x - sin * guideOffset,
        pose.y + cos * guideOffset,
        0,
      );
      padDummy.updateMatrix();
      guideMeshRef.current?.setMatrixAt(index, padDummy.matrix);

      [-0.052, 0.052].forEach((localX, pinIndex) => {
        pinDummy.position.set(
          pose.x + localX * cos,
          pose.y + localX * sin,
          side * 0.365,
        );
        pinDummy.rotation.set(Math.PI / 2, 0, 0);
        pinDummy.scale.set(1, 1, 1);
        pinDummy.updateMatrix();
        pinMeshRef.current?.setMatrixAt(index * 2 + pinIndex, pinDummy.matrix);
      });
    });

    if (padMeshRef.current) padMeshRef.current.instanceMatrix.needsUpdate = true;
    if (guideMeshRef.current) guideMeshRef.current.instanceMatrix.needsUpdate = true;
    if (pinMeshRef.current) pinMeshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group position={[0, 0.18, side * 0.72]}>
      <RoundedBox
        args={[2.36, 0.7, 0.52]}
        radius={0.22}
        smoothness={8}
        castShadow
      >
        <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
      </RoundedBox>
      <RoundedBox
        args={[1.8, 0.32, 0.58]}
        radius={0.1}
        smoothness={6}
        position={[0, 0.02, 0]}
        castShadow
      >
        <meshStandardMaterial color={COLOR.frameLight} {...MATERIAL.frame} />
      </RoundedBox>

      <TrackIdler
        style={idlerStyle}
        side={side}
        wheelRef={(node) => {
          wheels.current[0] = node;
        }}
      />
      <TrackSprocket
        style={sprocketStyle}
        side={side}
        wheelRef={(node) => {
          wheels.current[1] = node;
        }}
      />
      <TrackRollers
        count={rollerCount}
        side={side}
        startIndex={2}
        setWheelRef={(index, node) => {
          wheels.current[index] = node;
        }}
      />

      <instancedMesh
        ref={padMeshRef}
        args={[undefined, undefined, TRACK_PAD_COUNT]}
        castShadow
        frustumCulled={false}
      >
        <boxGeometry args={[0.155, 0.085, 0.7]} />
        <meshStandardMaterial color={COLOR.trackChain} roughness={0.34} metalness={0.68} />
      </instancedMesh>
      <instancedMesh
        ref={guideMeshRef}
        args={[undefined, undefined, TRACK_PAD_COUNT]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.105, 0.055, 0.2]} />
        <meshStandardMaterial color={COLOR.steel} roughness={0.42} metalness={0.55} />
      </instancedMesh>
      <instancedMesh
        ref={pinMeshRef}
        args={[undefined, undefined, TRACK_PAD_COUNT * 2]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.025, 0.025, 0.035, 10]} />
        <meshStandardMaterial color={COLOR.steelBright} roughness={0.24} metalness={0.8} />
      </instancedMesh>
    </group>
  );
}

function ChassisTrack({
  side,
  velRef,
  visual,
}: {
  side: 1 | -1;
  velRef: React.MutableRefObject<HydraulicVelocity>;
  visual: ChassisVisualProfile;
}) {
  const props = {
    side,
    velRef,
    idlerStyle: visual.idlerStyle,
    sprocketStyle: visual.sprocketStyle,
    rollerCount: visual.rollerCount,
  };
  if (visual.trackType === "steel") {
    return <SteelTrack {...props} />;
  }
  return <RubberTrack {...props} />;
}

/**
 * Fixed undercarriage carbody between the tracks + swing kingpost.
 * Sized from trackWidth so every chassis gets the same structure:
 * left/right tracks → center body → deck → bearing tube → house.
 * Light open-cab machines use the same cylindrical kingpost (not a flush plate join).
 */
function UndercarriageAssembly({
  trackWidth,
  scale = 1,
}: {
  trackWidth: number;
  scale?: number;
}) {
  // Match PremiumExcavatorBody track group scales (non-uniform).
  const trackScaleX = 0.58 * trackWidth;
  const trackScaleZ = 0.82 * trackWidth;
  const bodyW = getCarbodyWidth(trackWidth);
  const bodyL = 2.28 * trackScaleX;
  const bodyH = 0.46;
  const deckTopY = SWING_DECK_TOP_Y;
  const bodyCenterY = deckTopY - bodyH * 0.5 + 0.02;
  // Tall enough kingpost that light (scale≈0.9) machines still read a clear cylinder.
  const tubeH = SWING_KINGPOST_H;
  const tubeR = Math.max(0.17, 0.195 / Math.min(1, Math.max(0.88, scale)));
  const ringR = tubeR + 0.055;
  const bearingY = deckTopY + tubeH * 0.5;
  const cheekZ = bodyW * 0.5 + 0.04 * trackScaleZ;
  const armHalf = getDozerArmHalfWidth(trackWidth);
  const carbodyFrontX = bodyL * 0.5;

  return (
    <group position={[SWING_PIVOT_X, 0, 0]}>
      {/* Main carbody — fills the empty bay between left/right tracks */}
      <RoundedBox
        args={[bodyL, bodyH, bodyW]}
        radius={0.06}
        smoothness={5}
        position={[0, bodyCenterY, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
      </RoundedBox>
      {/* Belly pan (slightly inset, darker) */}
      <RoundedBox
        args={[bodyL * 0.92, bodyH * 0.55, bodyW * 0.78]}
        radius={0.045}
        smoothness={4}
        position={[0, bodyCenterY - bodyH * 0.12, 0]}
        castShadow
      >
        <meshStandardMaterial color={COLOR.frameLight} {...MATERIAL.frame} />
      </RoundedBox>
      {/* Front / rear crossmembers */}
      {([-1, 1] as const).map((end) => (
        <RoundedBox
          key={`xmember-${end}`}
          args={[bodyL * 0.14, bodyH * 0.72, bodyW * 1.08]}
          radius={0.04}
          smoothness={4}
          position={[end * bodyL * 0.42, bodyCenterY + 0.02, 0]}
          castShadow
        >
          <meshStandardMaterial color={COLOR.frameLight} {...MATERIAL.frame} />
        </RoundedBox>
      ))}
      {/* Side cheeks reaching toward each track frame */}
      {([-1, 1] as const).map((side) => (
        <RoundedBox
          key={`cheek-${side}`}
          args={[bodyL * 0.72, bodyH * 0.62, 0.1 * trackScaleZ]}
          radius={0.035}
          smoothness={4}
          position={[0, bodyCenterY + 0.01, side * cheekZ]}
          castShadow
        >
          <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
        </RoundedBox>
      ))}

      {/* Dozer mount on carbody front — arms attach here, not to the tracks */}
      <group position={[carbodyFrontX, bodyCenterY + 0.02, 0]}>
        <RoundedBox
          args={[0.18, bodyH * 0.78, bodyW * 0.92]}
          radius={0.035}
          smoothness={4}
          position={[0.02, 0, 0]}
          castShadow
        >
          <meshStandardMaterial color={COLOR.frameLight} {...MATERIAL.frame} />
        </RoundedBox>
        {([-1, 1] as const).map((side) => (
          <group key={`dozer-mount-${side}`} position={[0.1, 0.04, side * armHalf]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.09, 0.09, 0.16, 18]} />
              <meshStandardMaterial color={COLOR.steel} {...MATERIAL.steel} />
            </mesh>
            <RoundedBox
              args={[0.14, 0.16, 0.08]}
              radius={0.02}
              smoothness={3}
              position={[-0.06, 0, 0]}
              castShadow
            >
              <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
            </RoundedBox>
          </group>
        ))}
        {/* Center link ear */}
        <mesh position={[0.1, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.12, 16]} />
          <meshStandardMaterial color={COLOR.steel} {...MATERIAL.steel} />
        </mesh>
      </group>

      {/* Swing deck plate on carbody top */}
      <RoundedBox
        args={[Math.min(bodyL * 0.55, 1.05), 0.08, Math.min(bodyW * 0.95, 0.95)]}
        radius={0.04}
        smoothness={5}
        position={[0, deckTopY - 0.02, 0]}
        castShadow
      >
        <meshStandardMaterial color={COLOR.frameLight} {...MATERIAL.frame} />
      </RoundedBox>
      <RoundedBox
        args={[ringR * 2.15, 0.05, ringR * 2.15]}
        radius={0.03}
        smoothness={4}
        position={[0, deckTopY + 0.02, 0]}
        castShadow
      >
        <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
      </RoundedBox>

      {/* Kingpost tube — center of carbody → house (all classes) */}
      <group position={[0, bearingY, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[tubeR, tubeR * 1.04, tubeH, 40]} />
          <meshStandardMaterial color={COLOR.steel} {...MATERIAL.steel} />
        </mesh>
        {/* Mid collar so the shaft reads as a cylinder, not a flush spacer */}
        <mesh position={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[tubeR * 1.12, tubeR * 1.12, 0.04, 36]} />
          <meshStandardMaterial color={COLOR.frameLight} {...MATERIAL.frame} />
        </mesh>
        <mesh position={[0, -tubeH * 0.5, 0]} castShadow>
          <cylinderGeometry args={[ringR, ringR, 0.036, 40]} />
          <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
        </mesh>
        <mesh position={[0, tubeH * 0.5, 0]} castShadow>
          <cylinderGeometry args={[ringR * 0.96, ringR * 0.96, 0.032, 40]} />
          <meshStandardMaterial color={TRACK_WHEEL_HUB} {...MATERIAL.steel} />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          const boltR = ringR * 0.78;
          return (
            <mesh
              key={i}
              position={[
                Math.cos(a) * boltR,
                tubeH * 0.5,
                Math.sin(a) * boltR,
              ]}
            >
              <cylinderGeometry args={[0.012, 0.012, 0.034, 8]} />
              <meshStandardMaterial
                color={COLOR.steelBright}
                {...MATERIAL.steel}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

function PaintMaterial({
  color,
  dark = false,
}: {
  color: string;
  dark?: boolean;
}) {
  return (
    <meshPhysicalMaterial
      color={color}
      roughness={dark ? 0.32 : 0.22}
      metalness={0.18}
      clearcoat={0.55}
      clearcoatRoughness={0.28}
      envMapIntensity={0.85}
    />
  );
}

function GlassMaterial() {
  return (
    <meshPhysicalMaterial
      color={COLOR.glass}
      roughness={0.06}
      metalness={0.05}
      transmission={0.35}
      thickness={0.08}
      transparent
      opacity={0.72}
      envMapIntensity={1.1}
    />
  );
}
function CanopyCab({ variant = "twoPost" }: { variant?: CanopyVariant }) {
  const fourPost = variant === "fourPost";
  const posts = fourPost
    ? [
        { x: -0.56, z: -0.5 },
        { x: -0.56, z: 0.5 },
        { x: 0.28, z: -0.5 },
        { x: 0.28, z: 0.5 },
      ]
    : [
        { x: -0.56, z: -0.5 },
        { x: -0.56, z: 0.5 },
      ];

  return (
    <group position={[-0.82 + HOUSE_FROM_LEGACY, 1.62, -0.08]}>
      {posts.map((bar) => (
        <RoundedBox
          key={`${bar.x}:${bar.z}`}
          args={[0.07, 1.62, 0.07]}
          radius={0.028}
          smoothness={5}
          position={[bar.x, 0, bar.z]}
          castShadow
        >
          <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
        </RoundedBox>
      ))}
      {fourPost ? (
        <>
          <RoundedBox
            args={[1.05, 0.06, 0.06]}
            radius={0.02}
            smoothness={4}
            position={[-0.14, 0.78, -0.5]}
            castShadow
          >
            <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
          </RoundedBox>
          <RoundedBox
            args={[1.05, 0.06, 0.06]}
            radius={0.02}
            smoothness={4}
            position={[-0.14, 0.78, 0.5]}
            castShadow
          >
            <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
          </RoundedBox>
        </>
      ) : null}
      <RoundedBox
        args={[fourPost ? 1.35 : 1.22, 0.09, 1.18]}
        radius={0.04}
        smoothness={5}
        position={[fourPost ? -0.12 : 0, 0.84, 0]}
        castShadow
      >
        <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
      </RoundedBox>
      {/* Black canopy roof */}
      <RoundedBox
        args={[fourPost ? 1.48 : 1.36, 0.14, 1.28]}
        radius={0.06}
        smoothness={6}
        position={[fourPost ? -0.12 : 0, 0.94, 0]}
        castShadow
      >
        <meshStandardMaterial color="#1a1f24" {...MATERIAL.frame} />
      </RoundedBox>
      <mesh position={[0.05, -0.02, -0.52]}>
        <boxGeometry args={[0.95, 1.28, 0.022]} />
        <GlassMaterial />
      </mesh>
    </group>
  );
}

/** Single vertical ROPS (SV11) or arched ROPS (ViO12). */
function RollbarCab({ variant = "single" }: { variant?: RollbarVariant }) {
  if (variant === "arch") {
    return (
      <group position={[-1.0 + HOUSE_FROM_LEGACY, 1.52, -0.04]}>
        {[-0.42, 0.42].map((z) => (
          <RoundedBox
            key={`arch-leg-${z}`}
            args={[0.08, 1.48, 0.08]}
            radius={0.03}
            smoothness={5}
            position={[0, 0.12, z]}
            castShadow
          >
            <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
          </RoundedBox>
        ))}
        <mesh position={[0, 0.92, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.42, 0.04, 10, 24, Math.PI]} />
          <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
        </mesh>
        <RoundedBox
          args={[0.08, 0.08, 0.88]}
          radius={0.03}
          smoothness={4}
          position={[0, 0.92, 0]}
          castShadow
        >
          <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
        </RoundedBox>
      </group>
    );
  }

  return (
    <group position={[-1.05 + HOUSE_FROM_LEGACY, 1.55, -0.04]}>
      <RoundedBox
        args={[0.1, 1.62, 0.1]}
        radius={0.035}
        smoothness={5}
        position={[0, 0.15, 0]}
        castShadow
      >
        <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
      </RoundedBox>
      <RoundedBox
        args={[0.42, 0.08, 0.42]}
        radius={0.03}
        smoothness={4}
        position={[0.02, 0.96, 0]}
        castShadow
      >
        <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
      </RoundedBox>
    </group>
  );
}

/** Fully enclosed glass cab with red roof (CJR / ViO55+ / SV100). */
function EnclosedCab({
  bulk = 1,
  modelPlate,
}: {
  bulk?: number;
  modelPlate: string;
}) {
  const grow = Math.max(0, bulk - 1);
  const cabScale = Math.min(1.06, 1 + grow * 0.055);
  // Symmetric frame — keep Z centered so glass/doors don't look crooked.
  const pillarFrontX = 0.4;
  const pillarRearX = -0.5;
  const pillarZ = 0.56;
  const midX = (pillarFrontX + pillarRearX) * 0.5;
  const sideSpanX = pillarFrontX - pillarRearX - 0.1;
  const glassWidthZ = pillarZ * 2 - 0.1;
  const frontGlassX = pillarFrontX + 0.038;
  // Top-back rake only (pitch). Never use Z euler after Y=90° — that skews sideways.
  const glassRake = 0.12;

  const sideBrand = useMemo(
    () => createChassisModelSideBrandTexture(modelPlate),
    [modelPlate],
  );
  useLayoutEffect(() => () => sideBrand?.texture.dispose(), [sideBrand]);
  const plateWidth = Math.min(
    sideSpanX * 0.98,
    Math.max(0.72, modelPlate.length * 0.085),
  );
  const plateHeight = sideBrand ? plateWidth / sideBrand.aspect : 0.09;

  return (
    <group
      position={[-0.78 + HOUSE_FROM_LEGACY - grow * 0.03, 1.58, 0]}
      scale={[cabScale, cabScale, cabScale]}
    >
      {/* A/B pillars */}
      {[pillarRearX, pillarFrontX].map((x) =>
        ([-1, 1] as const).map((side) => (
          <RoundedBox
            key={`pillar-${x}-${side}`}
            args={[0.07, 1.72, 0.07]}
            radius={0.025}
            smoothness={5}
            position={[x, 0.06, side * pillarZ]}
            castShadow
          >
            <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
          </RoundedBox>
        )),
      )}
      {/* Lower sill */}
      <RoundedBox
        args={[1.18, 0.14, pillarZ * 2 + 0.12]}
        radius={0.04}
        smoothness={5}
        position={[midX, -0.72, 0]}
        castShadow
      >
        <meshStandardMaterial color={COLOR.frameLight} {...MATERIAL.frame} />
      </RoundedBox>
      {/* Roof rail */}
      <RoundedBox
        args={[1.22, 0.1, pillarZ * 2 + 0.1]}
        radius={0.04}
        smoothness={5}
        position={[midX, 0.94, 0]}
        castShadow
      >
        <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
      </RoundedBox>
      {/* Red roof */}
      <RoundedBox
        args={[1.34, 0.18, pillarZ * 2 + 0.18]}
        radius={0.07}
        smoothness={6}
        position={[midX, 1.06, 0]}
        castShadow
      >
        <PaintMaterial color={COLOR.paintRed} />
      </RoundedBox>

      {/* Front windshield — face +X, then pitch for rake (no lateral skew) */}
      <group position={[frontGlassX, 0.1, 0]} rotation={[0, Math.PI / 2, 0]}>
        <mesh rotation={[-glassRake, 0, 0]}>
          <boxGeometry args={[glassWidthZ, 1.3, 0.026]} />
          <GlassMaterial />
        </mesh>
      </group>

      {/* Side: upper window + lower door (beltline split) + model plate on door */}
      {([-1, 1] as const).map((side) => {
        const z = side * (pillarZ + 0.032);
        return (
          <group key={`cab-side-${side}`}>
            <mesh position={[midX, 0.3, z]}>
              <boxGeometry args={[sideSpanX, 0.7, 0.022]} />
              <GlassMaterial />
            </mesh>
            <RoundedBox
              args={[sideSpanX * 0.98, 0.58, 0.038]}
              radius={0.02}
              smoothness={4}
              position={[midX, -0.36, z]}
              castShadow
            >
              <meshStandardMaterial color={COLOR.frameLight} {...MATERIAL.frame} />
            </RoundedBox>
            {/* Beltline rail */}
            <RoundedBox
              args={[sideSpanX * 1.02, 0.045, 0.048]}
              radius={0.014}
              smoothness={4}
              position={[midX, -0.02, z]}
              castShadow
            >
              <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
            </RoundedBox>
            {sideBrand ? (
              <mesh
                position={[midX, -0.34, side * (pillarZ + 0.058)]}
                rotation={[0, side < 0 ? Math.PI : 0, 0]}
                renderOrder={24}
              >
                <planeGeometry args={[plateWidth, plateHeight]} />
                <meshBasicMaterial
                  map={sideBrand.texture}
                  transparent
                  alphaTest={0.12}
                  toneMapped={false}
                  depthWrite={false}
                  depthTest
                  side={THREE.DoubleSide}
                  polygonOffset
                  polygonOffsetFactor={-6}
                  polygonOffsetUnits={-6}
                />
              </mesh>
            ) : null}
          </group>
        );
      })}

      {/* Rear glass */}
      <mesh position={[pillarRearX - 0.036, 0.08, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[glassWidthZ, 1.18, 0.022]} />
        <GlassMaterial />
      </mesh>
    </group>
  );
}

function CabAssembly({ visual }: { visual: ChassisVisualProfile }) {
  switch (visual.cabStyle) {
    case "open":
      return null;
    case "rollbar":
      return <RollbarCab variant={visual.rollbarVariant ?? "single"} />;
    case "enclosed":
      return (
        <EnclosedCab bulk={visual.bodyBulk} modelPlate={visual.modelPlate} />
      );
    case "canopy":
    default:
      return <CanopyCab variant={visual.canopyVariant ?? "twoPost"} />;
  }
}

function Counterweight({
  bulk,
  rearMark,
}: {
  bulk: number;
  rearMark?: THREE.Texture | null;
}) {
  const w = 0.72 * bulk;
  const h = 0.78 * Math.min(1.25, bulk);
  const d = 1.62 * Math.min(1.2, bulk);
  const plateW = Math.min(d * 0.7, 1.18);
  const plateH = Math.min(h * 0.52, 0.4);
  return (
    <group position={[-1.28 - (bulk - 1) * 0.2 + HOUSE_FROM_LEGACY, 1.15, 0]}>
      <RoundedBox
        args={[w, h, d]}
        radius={0.14}
        smoothness={8}
        castShadow
      >
        <PaintMaterial color={COLOR.paintRed} />
      </RoundedBox>
      <RoundedBox
        args={[w * 0.55, h * 0.35, d * 0.72]}
        radius={0.08}
        smoothness={6}
        position={[-w * 0.12, h * 0.28, 0]}
        castShadow
      >
        <PaintMaterial color={COLOR.paintRedDark} dark />
      </RoundedBox>
      {rearMark ? (
        <mesh
          position={[-w * 0.5 - 0.014, 0.04, 0]}
          rotation={[0, -Math.PI / 2, 0]}
          renderOrder={28}
        >
          <planeGeometry args={[plateW, plateH]} />
          <meshBasicMaterial
            map={rearMark}
            transparent
            alphaTest={0.12}
            toneMapped={false}
            depthWrite={false}
            depthTest
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-6}
            polygonOffsetUnits={-6}
          />
        </mesh>
      ) : null}
    </group>
  );
}

function OperatorStation() {
  return (
    <group position={[-0.83 + HOUSE_FROM_LEGACY, 1.12, -0.04]}>
      <RoundedBox args={[0.62, 0.24, 0.62]} radius={0.11} smoothness={7} position={[-0.15, 0.08, 0]}>
        <meshStandardMaterial color={COLOR.interior} roughness={0.72} metalness={0.04} />
      </RoundedBox>
      <RoundedBox args={[0.16, 0.78, 0.6]} radius={0.08} smoothness={7} position={[-0.39, 0.45, 0]}>
        <meshStandardMaterial color="#303840" roughness={0.68} metalness={0.04} />
      </RoundedBox>
      {[-1, 1].map((side) => (
        <group key={`control-${side}`} position={[0.1, 0.32, side * 0.42]}>
          <RoundedBox args={[0.4, 0.12, 0.18]} radius={0.04} smoothness={5}>
            <meshStandardMaterial color={COLOR.frameLight} {...MATERIAL.frame} />
          </RoundedBox>
          <mesh position={[0, 0.24, 0]} rotation={[0, 0, -0.08]}>
            <cylinderGeometry args={[0.035, 0.045, 0.42, 14]} />
            <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
          </mesh>
          <mesh position={[-0.02, 0.46, 0]}>
            <sphereGeometry args={[0.085, 16, 12]} />
            <meshStandardMaterial color={COLOR.frame} roughness={0.58} metalness={0.18} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function PremiumDozerBlade({
  trackWidth = 1,
  scale = 1,
}: {
  trackWidth?: number;
  scale?: number;
}) {
  const moldboardProfile = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.035, -0.31);
    shape.lineTo(0.1, -0.31);
    shape.quadraticCurveTo(-0.075, 0, 0.1, 0.31);
    shape.lineTo(-0.035, 0.31);
    shape.quadraticCurveTo(-0.205, 0, -0.035, -0.31);
    shape.closePath();
    return shape;
  }, []);

  // Arms sit inside the center carbody bay (not on track/wheel centers).
  const armHalf = getDozerArmHalfWidth(trackWidth) / 0.88;
  const trackScaleX = 0.58 * trackWidth;
  const carbodyFront = 2.28 * trackScaleX * 0.5;
  const reach = getDozerBladeReach(scale, trackWidth);
  // Span from blade face back into the carbody front mount (parent-space → local).
  const armSpan = Math.max(0.7, (reach - carbodyFront + 0.18) / 0.88);
  const armMid = -armSpan * 0.48;
  const armKnuckle = -armSpan * 0.92;

  return (
    <group position={[YANMAR_MACHINE_RIG.dozerBladeMeshLocalX, -0.08, 0]}>
      <group scale={[0.88, 0.8, 0.88]}>
        {/* 곡면 몰드보드: 흙과 눈을 말아 올리며 앞으로 미는 실제 블레이드 단면 */}
        <mesh position={[0, 0, -1.24]} castShadow receiveShadow>
          <extrudeGeometry
            args={[
              moldboardProfile,
              {
                depth: 2.48,
                bevelEnabled: true,
                bevelSize: 0.018,
                bevelThickness: 0.018,
                bevelSegments: 3,
                curveSegments: 12,
              },
            ]}
          />
          <meshStandardMaterial
            color={COLOR.dozerBlade}
            roughness={0.36}
            metalness={0.52}
          />
        </mesh>

        {/* 교체식 하단 절삭날 */}
        <mesh position={[0.075, -0.345, 0]} rotation={[0, 0, 0.055]} castShadow>
          <boxGeometry args={[0.14, 0.095, 2.62]} />
          <meshStandardMaterial color={COLOR.dozerBladeEdge} {...MATERIAL.steel} />
        </mesh>

        {/* 상단 말림 방지 보강 빔 */}
        <RoundedBox
          args={[0.13, 0.095, 2.5]}
          radius={0.035}
          smoothness={5}
          position={[0.035, 0.325, 0]}
          castShadow
        >
          <meshStandardMaterial color={COLOR.dozerBladeArm} {...MATERIAL.frame} />
        </RoundedBox>

        {/* 양 끝 측판으로 밀린 토사와 눈이 옆으로 새는 양을 줄인다. */}
        {[-1.275, 1.275].map((z) => (
          <mesh
            key={`blade-side-${z}`}
            position={[0, 0, z]}
            castShadow
          >
            <shapeGeometry args={[moldboardProfile, 12]} />
            <meshStandardMaterial
              color={COLOR.dozerBladeArm}
              {...MATERIAL.frame}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}

        {/* 후면 리브 — 중앙 차대 폭 안에만 */}
        {[-armHalf, 0, armHalf].map((z) => (
          <mesh key={`blade-rib-${z}`} position={[-0.1, 0, z]} castShadow>
            <boxGeometry args={[0.09, 0.54, 0.07]} />
            <meshStandardMaterial color={COLOR.dozerBladeArm} {...MATERIAL.frame} />
          </mesh>
        ))}

        {/* Push arms: carbody mounts → blade (narrow track of center body) */}
        {([-1, 1] as const).map((side) => (
          <group key={`blade-arm-${side}`} position={[0, 0, side * armHalf]}>
            <mesh
              position={[armMid, 0.04, 0]}
              rotation={[0, 0, -0.22]}
              castShadow
            >
              <boxGeometry args={[armSpan * 0.9, 0.12, 0.11]} />
              <meshStandardMaterial color={COLOR.dozerBladeArm} {...MATERIAL.frame} />
            </mesh>
            {/* Blade-side pivot */}
            <mesh position={[-0.12, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.07, 0.07, 0.14, 16]} />
              <meshStandardMaterial color={COLOR.steel} {...MATERIAL.steel} />
            </mesh>
            {/* Carbody-side knuckle */}
            <mesh
              position={[armKnuckle, 0.1, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
            >
              <cylinderGeometry args={[0.085, 0.085, 0.15, 18]} />
              <meshStandardMaterial color={COLOR.steel} {...MATERIAL.steel} />
            </mesh>
          </group>
        ))}
        {/* Center strut into front mount ear */}
        <mesh position={[armMid * 1.05, 0.08, 0]} rotation={[0, 0, -0.18]} castShadow>
          <boxGeometry args={[armSpan * 0.75, 0.09, 0.08]} />
          <meshStandardMaterial color={COLOR.dozerBladeArm} {...MATERIAL.frame} />
        </mesh>
      </group>
    </group>
  );
}

function UpperHood({
  visual,
}: {
  visual: ChassisVisualProfile;
}) {
  const bulk = visual.bodyBulk;
  const isOpen = visual.cabStyle === "open";
  const isEnclosed = visual.cabStyle === "enclosed";
  const hoodLen =
    (isOpen ? 1.55 : isEnclosed ? 1.48 : 1.82) *
    Math.min(isEnclosed ? 1.06 : 1.18, 0.92 + bulk * (isEnclosed ? 0.045 : 0.08));
  const hoodH = (isOpen ? 0.5 : 0.58) * Math.min(1.15, bulk);
  // Enclosed hood must stay narrower than the cab so side faces don't poke past the windshield.
  const hoodD =
    (isOpen ? 1.55 : isEnclosed ? 1.18 : 1.78) *
    Math.min(isEnclosed ? 1.02 : 1.22, 0.9 + bulk * (isEnclosed ? 0.04 : 0.1));
  const noseLen =
    (isOpen ? 0.55 : isEnclosed ? 0.32 : 0.72) *
    Math.min(isEnclosed ? 1.02 : 1.2, bulk);
  const noseH =
    (isOpen ? 0.62 : isEnclosed ? 0.48 : 0.74) * Math.min(1.12, bulk);
  // Enclosed: pull the growing engine hood rearward so it doesn't swallow the windshield.
  const hoodShiftX =
    -0.38 -
    (bulk - 1) * 0.08 +
    HOUSE_FROM_LEGACY -
    (isEnclosed ? 0.28 + (bulk - 1) * 0.18 : 0);
  const noseForward = isEnclosed ? 0.04 : 0.32;

  const sideBrand = useMemo(
    () =>
      isEnclosed
        ? null
        : createChassisModelSideBrandTexture(visual.modelPlate),
    [isEnclosed, visual.modelPlate],
  );
  useLayoutEffect(() => () => sideBrand?.texture.dispose(), [sideBrand]);

  const isVio17HdMark = visual.modelPlate === "ViO17-1";
  const plateWidth = Math.min(
    1.35,
    isVio17HdMark
      ? 1.18
      : Math.max(0.78, visual.modelPlate.length * 0.11),
  );
  const plateHeight = sideBrand
    ? plateWidth / sideBrand.aspect
    : 0.09;
  const plateX = hoodLen * 0.08;
  const plateY = isOpen ? 0.06 : 0.1;
  // Sit just outside the rounded hood side face so the plate isn't buried in paint.
  const plateZ = hoodD * 0.5 + 0.02;

  return (
    <group position={[hoodShiftX, 0.95, 0]}>
      <RoundedBox args={[hoodLen, hoodH, hoodD]} radius={0.18} smoothness={9} castShadow>
        <PaintMaterial color={COLOR.paintRed} />
      </RoundedBox>
      <RoundedBox
        args={[noseLen, noseH, hoodD * (isEnclosed ? 0.78 : 0.9)]}
        radius={0.16}
        smoothness={9}
        position={[hoodLen * noseForward, 0.16, 0]}
        castShadow
      >
        <PaintMaterial color={COLOR.paintRedBright} />
      </RoundedBox>
      {[-1, 1].map((side) => (
        <group
          key={`engine-grille-${side}`}
          position={[
            hoodLen * (isEnclosed ? 0.08 : 0.36),
            0.16,
            side * (hoodD * (isEnclosed ? 0.42 : 0.46)),
          ]}
        >
          <RoundedBox
            args={[isEnclosed ? 0.36 : 0.48, isEnclosed ? 0.32 : 0.4, 0.035]}
            radius={0.05}
            smoothness={5}
          >
            <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
          </RoundedBox>
          {[-0.1, 0, 0.1].map((y) => (
            <mesh key={y} position={[0, y, side * 0.025]}>
              <boxGeometry args={[isEnclosed ? 0.28 : 0.36, 0.025, 0.025]} />
              <meshStandardMaterial color={COLOR.steel} {...MATERIAL.steel} />
            </mesh>
          ))}
        </group>
      ))}
      {[-1, 1].map((side) => (
        <mesh
          key={`body-highlight-${side}`}
          position={[isEnclosed ? -0.28 : -0.15, 0.28, side * (hoodD * 0.51)]}
        >
          <boxGeometry
            args={[hoodLen * (isEnclosed ? 0.42 : 0.55), 0.038, 0.035]}
          />
          <meshStandardMaterial color={COLOR.paintHighlight} {...MATERIAL.painted} />
        </mesh>
      ))}
      {([-1, 1] as const).map((side) => (
        <group
          key={`body-decals-${side}`}
          position={[plateX, plateY, side * plateZ]}
        >
          {sideBrand ? (
            <mesh
              rotation={[0, side < 0 ? Math.PI : 0, 0]}
              renderOrder={20}
            >
              <planeGeometry args={[plateWidth, plateHeight]} />
              <meshBasicMaterial
                map={sideBrand.texture}
                transparent
                alphaTest={0.12}
                toneMapped={false}
                depthWrite={false}
                depthTest
                side={THREE.DoubleSide}
                polygonOffset
                polygonOffsetFactor={-4}
                polygonOffsetUnits={-4}
              />
            </mesh>
          ) : null}
          <mesh
            position={[
              hoodLen * (isEnclosed ? 0.28 : 0.32),
              -0.16,
              side * 0.002,
            ]}
          >
            <circleGeometry args={[0.1, 3]} />
            <meshStandardMaterial color={COLOR.warning} roughness={0.38} metalness={0.08} />
          </mesh>
        </group>
      ))}
      {/* Heavier enclosed machines get a taller rear deck lip */}
      {isEnclosed ? (
        <RoundedBox
          args={[0.32 * bulk, 0.2, hoodD * 0.72]}
          radius={0.06}
          smoothness={5}
          position={[-hoodLen * 0.4, 0.3, 0]}
          castShadow
        >
          <PaintMaterial color={COLOR.paintRedDark} dark />
        </RoundedBox>
      ) : null}
    </group>
  );
}

export function PremiumExcavatorBody({
  velRef,
  ykLogo,
  upperBodyRef,
  chassisId,
}: {
  velRef: React.MutableRefObject<HydraulicVelocity>;
  ykLogo?: THREE.Texture;
  upperBodyRef?: React.Ref<THREE.Group>;
  chassisId?: ChassisModelId | string;
}) {
  const visual = getChassisVisualProfile(chassisId);
  const ykBlackLogo = useLoader(THREE.TextureLoader, YK_GEONGI_LOGO.black);
  const rearYkPlate = useMemo(() => {
    const image = ykBlackLogo.image as CanvasImageSource | undefined;
    if (!image) return null;
    return createYkGeongiNumberPlateTexture(image, "1588-3806");
  }, [ykBlackLogo]);
  useLayoutEffect(() => () => rearYkPlate?.dispose(), [rearYkPlate]);
  const trackScaleX = 0.58 * visual.trackWidth;
  const trackScaleZ = 0.82 * visual.trackWidth;
  const bodyXZ = 0.58 * (0.94 + visual.bodyBulk * 0.06);
  const bodyZ = 0.82 * (0.94 + visual.bodyBulk * 0.06);

  return (
    <group scale={[visual.scale, visual.scale, visual.scale]}>
      {/* Fixed undercarriage — track center = swing pivot (X=0) */}
      <group scale={[trackScaleX, 1, trackScaleZ]}>
        <group position={[SWING_PIVOT_X, 0.24, 0]}>
          {([-1, 1] as const).map((side) => (
            <ChassisTrack
              key={side}
              side={side}
              velRef={velRef}
              visual={visual}
            />
          ))}
        </group>
      </group>

      {/* Center carbody + swing tube (all chassis share this structure) */}
      <UndercarriageAssembly
        trackWidth={visual.trackWidth}
        scale={visual.scale}
      />

      {/* House yaws about undercarriage center, raised clear of tracks */}
      <group
        ref={upperBodyRef}
        position={[SWING_PIVOT_X, SWING_HOUSE_LIFT_Y, 0]}
      >
        <group scale={[bodyXZ, 1, bodyZ]}>
          {/* House floor sitting on the bearing upper race */}
          <RoundedBox
            args={[0.95, 0.1, 0.88]}
            radius={0.045}
            smoothness={6}
            position={[0, SWING_HOUSE_FLOOR_LOCAL_Y, 0]}
            castShadow
          >
            <meshStandardMaterial color={COLOR.frameLight} {...MATERIAL.frame} />
          </RoundedBox>
          <mesh position={[0, SWING_HOUSE_FLOOR_LOCAL_Y - 0.04, 0]}>
            <cylinderGeometry args={[0.3, 0.32, 0.045, 36]} />
            <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
          </mesh>

          <UpperHood visual={visual} />

          <Counterweight bulk={visual.bodyBulk} rearMark={rearYkPlate ?? ykLogo} />
          <OperatorStation />
          <CabAssembly visual={visual} />

          {([-1, 1] as const).map((side) => (
            <group
              key={`work-light-${side}`}
              position={[
                (visual.cabStyle === "open" ? -0.55 : -0.47) + HOUSE_FROM_LEGACY,
                visual.cabStyle === "open"
                  ? 1.82
                  : visual.cabStyle === "enclosed"
                    ? 2.68
                    : 2.54,
                side * 0.43,
              ]}
            >
              <RoundedBox args={[0.24, 0.14, 0.16]} radius={0.035} smoothness={4}>
                <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
              </RoundedBox>
              <mesh position={[0.02, 0, side * 0.085]}>
                <boxGeometry args={[0.15, 0.08, 0.02]} />
                <meshStandardMaterial
                  color={COLOR.lamp}
                  emissive="#ffe4a3"
                  emissiveIntensity={0.72}
                  roughness={0.12}
                  metalness={0.08}
                />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}

export function PremiumExcavatorLink({
  length,
  height,
  sideDepth,
  logo,
  logoWidth = 1,
  logoHeight = 0.2,
  logoX,
  logoRotation = 0,
  /** Open sky-facing channel so a hydraulic cylinder can sit inside. */
  openTop = false,
}: {
  length: number;
  height: number;
  sideDepth: number;
  logo?: THREE.Texture;
  logoWidth?: number;
  logoHeight?: number;
  logoX?: number;
  logoRotation?: number;
  openTop?: boolean;
}) {
  return (
    <group>
      {openTop ? (
        <>
          {/* Belly web only — leaves the top open as a U-channel */}
          <RoundedBox
            args={[length * 0.9, height * 0.28, sideDepth * 1.5]}
            radius={Math.min(0.1, height * 0.18)}
            smoothness={6}
            position={[length * 0.52, -height * 0.22, 0]}
            castShadow
          >
            <meshStandardMaterial
              color={COLOR.paintRedDark}
              {...MATERIAL.paintedDark}
            />
          </RoundedBox>
          {/* Thin inner floor so the channel reads as a box section */}
          <mesh position={[length * 0.55, -height * 0.02, 0]} castShadow>
            <boxGeometry args={[length * 0.78, height * 0.06, sideDepth * 1.15]} />
            <meshStandardMaterial
              color={COLOR.paintRedDark}
              {...MATERIAL.paintedDark}
            />
          </mesh>
        </>
      ) : (
        <RoundedBox
          args={[length * 0.88, height * 0.68, sideDepth * 1.55]}
          radius={Math.min(0.14, height * 0.28)}
          smoothness={7}
          position={[length * 0.52, 0, 0]}
          castShadow
        >
          <meshStandardMaterial
            color={COLOR.paintRedDark}
            {...MATERIAL.paintedDark}
          />
        </RoundedBox>
      )}
      {[-1, 1].map((side) => (
        <group key={`link-side-${side}`} position={[0, 0, side * sideDepth]}>
          <RoundedBox
            args={[length, height, 0.085]}
            radius={Math.min(0.13, height * 0.26)}
            smoothness={7}
            position={[length / 2, 0, 0]}
            castShadow
          >
            <meshStandardMaterial color={COLOR.paintRed} {...MATERIAL.painted} />
          </RoundedBox>
          {openTop ? (
            // Top flange of the open channel (does not close the sky face)
            <mesh position={[length * 0.52, height * 0.42, side * 0.02]}>
              <boxGeometry args={[length * 0.78, height * 0.06, 0.055]} />
              <meshStandardMaterial
                color={COLOR.paintHighlight}
                {...MATERIAL.painted}
              />
            </mesh>
          ) : (
            <mesh position={[length * 0.52, height * 0.39, side * 0.052]}>
              <boxGeometry args={[length * 0.72, height * 0.075, 0.022]} />
              <meshStandardMaterial
                color={COLOR.paintHighlight}
                {...MATERIAL.painted}
              />
            </mesh>
          )}
          <mesh position={[length * 0.56, -height * 0.4, side * 0.052]}>
            <boxGeometry args={[length * 0.68, height * 0.09, 0.024]} />
            <meshStandardMaterial
              color={COLOR.paintRedDark}
              {...MATERIAL.paintedDark}
            />
          </mesh>
          {logo && logoX != null ? (
            <mesh
              position={[logoX, 0.025, side * 0.07]}
              rotation={[0, side < 0 ? Math.PI : 0, logoRotation]}
              renderOrder={12}
            >
              <planeGeometry args={[logoWidth, logoHeight]} />
              <meshBasicMaterial
                map={logo}
                transparent
                alphaTest={0.3}
                toneMapped={false}
                depthWrite={false}
                side={THREE.FrontSide}
              />
            </mesh>
          ) : null}
        </group>
      ))}
    </group>
  );
}

/**
 * SV 스타일 gooseneck 붐 — 발(0,0)·암 피벗(length,0)은 키네마틱과 동일,
 * 중간만 앞으로~위쪽으로 약 45° 꺾인 시각 형상.
 */
export function PremiumExcavatorBoom({
  length,
  height,
  sideDepth,
  logo,
  logoWidth = 1,
  logoHeight = 0.2,
}: {
  length: number;
  height: number;
  sideDepth: number;
  logo?: THREE.Texture;
  logoWidth?: number;
  logoHeight?: number;
}) {
  const kinkX = length * YANMAR_MACHINE_RIG.boomGooseneckKinkAlong;
  const kinkY = Math.min(
    YANMAR_MACHINE_RIG.boomGooseneckKinkRiseCap,
    length * YANMAR_MACHINE_RIG.boomGooseneckKinkRise,
  );
  const lowerDx = kinkX;
  const lowerDy = kinkY;
  const lowerLen = Math.hypot(lowerDx, lowerDy);
  const lowerAngle = Math.atan2(lowerDy, lowerDx);
  const upperDx = length - kinkX;
  const upperDy = -kinkY;
  const upperLen = Math.hypot(upperDx, upperDy);
  const upperAngle = Math.atan2(upperDy, upperDx);

  return (
    <group>
      {/* 하부: 발 → 꺾임 */}
      <group position={[0, 0, 0]} rotation={[0, 0, lowerAngle]}>
        <PremiumExcavatorLink
          length={lowerLen}
          height={height}
          sideDepth={sideDepth}
        />
      </group>

      {/* 꺾임 보강 (관절 플레이트 — 실린더 덮개 아님) */}
      <group position={[kinkX, kinkY, 0]}>
        {[-1, 1].map((side) => (
          <RoundedBox
            key={`kink-cheek-${side}`}
            args={[height * 0.95, height * 1.05, 0.09]}
            radius={0.08}
            smoothness={5}
            position={[0, 0, side * sideDepth]}
            castShadow
          >
            <meshStandardMaterial color={COLOR.paintRed} {...MATERIAL.painted} />
          </RoundedBox>
        ))}
        <RoundedBox
          args={[height * 0.55, height * 0.55, sideDepth * 1.35]}
          radius={0.08}
          smoothness={5}
          castShadow
        >
          <meshStandardMaterial
            color={COLOR.paintRedDark}
            {...MATERIAL.paintedDark}
          />
        </RoundedBox>
      </group>

      {/* 상부: 꺾임 → 암 피벗 — 등쪽 오픈 채널로 암 실린더가 직선으로 앉음 */}
      <group position={[kinkX, kinkY, 0]} rotation={[0, 0, upperAngle]}>
        <PremiumExcavatorLink
          length={upperLen}
          height={height * 0.96}
          sideDepth={sideDepth}
          logo={logo}
          logoWidth={logoWidth}
          logoHeight={logoHeight}
          logoX={upperLen * 0.52}
          openTop
        />
      </group>
    </group>
  );
}
