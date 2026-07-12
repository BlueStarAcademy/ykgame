"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { HydraulicVelocity } from "./controls";
import {
  createYkGeongiMarkTexture,
  YANMAR_MACHINE_COLORS as COLOR,
  YANMAR_MACHINE_MATERIALS as MATERIAL,
} from "./machineVisualTheme";

const TRACK_PAD_COUNT = 34;
const TRACK_STRAIGHT_HALF = 0.86;
const TRACK_LOOP_RADIUS = 0.38;
const TRACK_STRAIGHT_LENGTH = TRACK_STRAIGHT_HALF * 2;
const TRACK_ARC_LENGTH = Math.PI * TRACK_LOOP_RADIUS;
const TRACK_LOOP_LENGTH = TRACK_STRAIGHT_LENGTH * 2 + TRACK_ARC_LENGTH * 2;
const TRACK_WHEEL_DARK = "#14191d";
const TRACK_WHEEL_HUB = "#30373c";

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

function PremiumTrack({
  side,
  velRef,
}: {
  side: 1 | -1;
  velRef: React.MutableRefObject<HydraulicVelocity>;
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
  const rollers = [-0.72, -0.36, 0, 0.36, 0.72];

  useFrame((_, delta) => {
    // side -1 = left track, +1 = right track — match lever independently.
    const speed = side < 0 ? velRef.current.trackLeft : velRef.current.trackRight;
    // Bottom pads must travel rearward when the machine moves forward.
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
        args={[2.36, 0.72, 0.55]}
        radius={0.31}
        smoothness={10}
        castShadow
      >
        <meshStandardMaterial color={COLOR.rubber} {...MATERIAL.rubber} />
      </RoundedBox>
      <RoundedBox
        args={[1.74, 0.3, 0.6]}
        radius={0.13}
        smoothness={7}
        position={[0, 0.02, 0]}
        castShadow
      >
        <meshStandardMaterial color={COLOR.frameLight} {...MATERIAL.frame} />
      </RoundedBox>

      {[-TRACK_STRAIGHT_HALF, TRACK_STRAIGHT_HALF].map((x, index) => (
        <group
          key={`drive-wheel-${x}`}
          ref={(node) => {
            wheels.current[index] = node;
          }}
          position={[x, 0.01, side * 0.28]}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.34, 0.34, 0.16, 32]} />
            <meshStandardMaterial color={TRACK_WHEEL_DARK} {...MATERIAL.frame} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.19, 20]} />
            <meshStandardMaterial color={TRACK_WHEEL_HUB} {...MATERIAL.steel} />
          </mesh>
          {Array.from({ length: 10 }, (_, tooth) => {
            const angle = (tooth / 10) * Math.PI * 2;
            return (
              <mesh
                key={tooth}
                position={[Math.cos(angle) * 0.3, Math.sin(angle) * 0.3, 0]}
                rotation={[0, 0, angle]}
              >
                <boxGeometry args={[0.11, 0.045, 0.16]} />
                <meshStandardMaterial color={COLOR.rubberHighlight} {...MATERIAL.frame} />
              </mesh>
            );
          })}
        </group>
      ))}

      {rollers.map((x, index) => (
        <group
          key={`roller-${x}`}
          ref={(node) => {
            wheels.current[index + 2] = node;
          }}
          position={[x, -0.08, side * 0.28]}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.19, 0.19, 0.14, 24]} />
            <meshStandardMaterial color={TRACK_WHEEL_DARK} {...MATERIAL.frame} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.085, 0.085, 0.17, 18]} />
            <meshStandardMaterial color={TRACK_WHEEL_HUB} {...MATERIAL.steel} />
          </mesh>
        </group>
      ))}

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
        <meshStandardMaterial color={COLOR.rubberHighlight} roughness={0.42} metalness={0.46} />
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

function RollBar() {
  const bars = [
    { x: -0.56, y: 0, z: -0.5 },
    { x: -0.56, y: 0, z: 0.5 },
    { x: 0.56, y: 0, z: -0.5 },
    { x: 0.56, y: 0, z: 0.5 },
  ];

  return (
    <group position={[-0.82, 1.52, -0.08]}>
      {bars.map((bar) => (
        <RoundedBox
          key={`${bar.x}:${bar.z}`}
          args={[0.075, 1.65, 0.075]}
          radius={0.03}
          smoothness={5}
          position={[bar.x, bar.y, bar.z]}
          castShadow
        >
          <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
        </RoundedBox>
      ))}
      <RoundedBox
        args={[1.28, 0.1, 1.18]}
        radius={0.04}
        smoothness={5}
        position={[0, 0.84, 0]}
        castShadow
      >
        <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
      </RoundedBox>
      <RoundedBox
        args={[1.42, 0.16, 1.28]}
        radius={0.07}
        smoothness={6}
        position={[0, 0.94, 0]}
        castShadow
      >
        <meshStandardMaterial color={COLOR.paintRed} {...MATERIAL.painted} />
      </RoundedBox>
      <mesh position={[0, -0.03, -0.52]}>
        <boxGeometry args={[1.02, 1.4, 0.025]} />
        <meshStandardMaterial color={COLOR.glass} {...MATERIAL.glass} />
      </mesh>
    </group>
  );
}

function OperatorStation() {
  return (
    <group position={[-0.83, 1.02, -0.04]}>
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

export function PremiumDozerBlade() {
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

  return (
    <group position={[1.8, -0.08, 0]}>
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

        {/* 후면 수직 리브와 차체 연결 암 */}
        {[-0.78, 0, 0.78].map((z) => (
          <mesh key={`blade-rib-${z}`} position={[-0.105, 0, z]} castShadow>
            <boxGeometry args={[0.09, 0.54, 0.075]} />
            <meshStandardMaterial color={COLOR.dozerBladeArm} {...MATERIAL.frame} />
          </mesh>
        ))}
        {[-0.72, 0.72].map((z) => (
          <group key={`blade-arm-${z}`}>
            <mesh position={[-0.46, 0.02, z]} rotation={[0, 0, -0.38]} castShadow>
              <boxGeometry args={[0.86, 0.13, 0.14]} />
              <meshStandardMaterial color={COLOR.dozerBladeArm} {...MATERIAL.frame} />
            </mesh>
            <mesh position={[-0.82, 0.18, z]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.105, 0.105, 0.18, 20]} />
              <meshStandardMaterial color={COLOR.steel} {...MATERIAL.steel} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

export function PremiumExcavatorBody({
  velRef,
  yanmarLogo,
  yanmarLogoWidth = 0.72,
  yanmarLogoHeight = 0.087,
  yanmarLogoX = 0,
  ykLogo,
  upperBodyRef,
}: {
  velRef: React.MutableRefObject<HydraulicVelocity>;
  yanmarLogo?: THREE.Texture;
  yanmarLogoWidth?: number;
  yanmarLogoHeight?: number;
  yanmarLogoX?: number;
  ykLogo?: THREE.Texture;
  upperBodyRef?: React.Ref<THREE.Group>;
}) {
  const premiumRearMark = useMemo(() => createYkGeongiMarkTexture("1588-3806"), []);
  useLayoutEffect(() => () => premiumRearMark?.dispose(), [premiumRearMark]);
  const rearMark = premiumRearMark ?? ykLogo;

  return (
    <group>
      <group>
        <group scale={[0.58, 1, 0.82]}>
          <group position={[-0.72, 0.24, 0]}>
            {[-1, 1].map((side) => (
              <PremiumTrack key={side} side={side as 1 | -1} velRef={velRef} />
            ))}
          </group>
        </group>
      </group>

      <group ref={upperBodyRef}>
        <group scale={[0.58, 1, 0.82]}>
        <group position={[-0.72, 0.24, 0]}>
          <RoundedBox args={[2.12, 0.24, 1.76]} radius={0.09} smoothness={6} position={[0.02, 0.48, 0]} castShadow>
            <meshStandardMaterial color={COLOR.frameLight} {...MATERIAL.frame} />
          </RoundedBox>
          <mesh position={[0.02, 0.62, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.73, 0.73, 1.5, 36]} />
            <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
          </mesh>
        </group>
        <group position={[-0.38, 0.83, 0]}>
        <RoundedBox args={[1.82, 0.58, 1.78]} radius={0.18} smoothness={9} castShadow>
          <meshStandardMaterial color={COLOR.paintRed} {...MATERIAL.painted} />
        </RoundedBox>
        <RoundedBox args={[0.72, 0.74, 1.58]} radius={0.18} smoothness={9} position={[0.58, 0.2, 0]} castShadow>
          <meshStandardMaterial color={COLOR.paintRedBright} {...MATERIAL.painted} />
        </RoundedBox>
        {[-1, 1].map((side) => (
          <group key={`engine-grille-${side}`} position={[0.66, 0.2, side * 0.82]}>
            <RoundedBox args={[0.5, 0.42, 0.035]} radius={0.06} smoothness={5}>
              <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
            </RoundedBox>
            {[-0.12, 0, 0.12].map((y) => (
              <mesh key={y} position={[0, y, side * 0.025]}>
                <boxGeometry args={[0.38, 0.025, 0.025]} />
                <meshStandardMaterial color={COLOR.steel} {...MATERIAL.steel} />
              </mesh>
            ))}
          </group>
        ))}
        <RoundedBox args={[0.68, 0.22, 1.88]} radius={0.08} smoothness={6} position={[-1.06, -0.02, 0]} castShadow>
          <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
        </RoundedBox>
        {[-1, 1].map((side) => (
          <mesh key={`body-highlight-${side}`} position={[-0.2, 0.28, side * 0.91]}>
            <boxGeometry args={[1.12, 0.045, 0.035]} />
            <meshStandardMaterial color={COLOR.paintHighlight} {...MATERIAL.painted} />
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <group key={`body-decals-${side}`} position={[0, 0, side * 0.925]}>
            {yanmarLogo ? (
              <mesh
                position={[yanmarLogoX, 0.11, 0]}
                rotation={[0, side < 0 ? Math.PI : 0, 0]}
                renderOrder={12}
              >
                <planeGeometry args={[yanmarLogoWidth, yanmarLogoHeight]} />
                <meshBasicMaterial
                  map={yanmarLogo}
                  transparent
                  alphaTest={0.25}
                  toneMapped={false}
                  depthWrite={false}
                  side={THREE.DoubleSide}
                />
              </mesh>
            ) : null}
            <mesh position={[0.72, -0.12, 0.012]}>
              <circleGeometry args={[0.11, 3]} />
              <meshStandardMaterial color={COLOR.warning} roughness={0.38} metalness={0.08} />
            </mesh>
          </group>
        ))}
      </group>

      <OperatorStation />
      <RollBar />
      {rearMark ? (
        <mesh position={[-1.445, 1.12, 0]} rotation={[0, -Math.PI / 2, 0]} renderOrder={19}>
          <planeGeometry args={[1.06, 0.372]} />
          <meshBasicMaterial
            map={rearMark}
            transparent
            alphaTest={0.2}
            toneMapped={false}
            depthWrite={false}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      ) : null}

      {[-1, 1].map((side) => (
        <group key={`work-light-${side}`} position={[-0.47, 2.44, side * 0.43]}>
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
}: {
  length: number;
  height: number;
  sideDepth: number;
  logo?: THREE.Texture;
  logoWidth?: number;
  logoHeight?: number;
  logoX?: number;
  logoRotation?: number;
}) {
  return (
    <group>
      <RoundedBox
        args={[length * 0.88, height * 0.68, sideDepth * 1.55]}
        radius={Math.min(0.14, height * 0.28)}
        smoothness={7}
        position={[length * 0.52, 0, 0]}
        castShadow
      >
        <meshStandardMaterial color={COLOR.paintRedDark} {...MATERIAL.paintedDark} />
      </RoundedBox>
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
          <mesh position={[length * 0.52, height * 0.39, side * 0.052]}>
            <boxGeometry args={[length * 0.72, height * 0.075, 0.022]} />
            <meshStandardMaterial color={COLOR.paintHighlight} {...MATERIAL.painted} />
          </mesh>
          <mesh position={[length * 0.56, -height * 0.4, side * 0.052]}>
            <boxGeometry args={[length * 0.68, height * 0.09, 0.024]} />
            <meshStandardMaterial color={COLOR.paintRedDark} {...MATERIAL.paintedDark} />
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
