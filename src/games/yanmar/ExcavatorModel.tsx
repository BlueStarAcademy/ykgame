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

function PremiumTrack({
  side,
  velRef,
}: {
  side: 1 | -1;
  velRef: React.MutableRefObject<HydraulicVelocity>;
}) {
  const wheels = useRef<(THREE.Group | null)[]>([]);
  const pads = Array.from({ length: 12 }, (_, index) => index);
  const rollers = [-0.72, -0.36, 0, 0.36, 0.72];

  useFrame((_, delta) => {
    const speed = velRef.current.travel + velRef.current.trackTurn * side * 0.58;
    if (Math.abs(speed) < 0.01) return;
    wheels.current.forEach((wheel) => {
      if (wheel) wheel.rotation.z -= speed * delta * 2.4;
    });
  });

  return (
    <group position={[0, 0, side * 0.72]}>
      <RoundedBox
        args={[2.2, 0.58, 0.55]}
        radius={0.18}
        smoothness={8}
        castShadow
      >
        <meshStandardMaterial color={COLOR.rubber} {...MATERIAL.rubber} />
      </RoundedBox>
      <RoundedBox
        args={[1.9, 0.34, 0.6]}
        radius={0.13}
        smoothness={7}
        position={[0, 0.08, 0]}
        castShadow
      >
        <meshStandardMaterial color={COLOR.frameLight} {...MATERIAL.frame} />
      </RoundedBox>

      {[-0.95, 0.95].map((x, index) => (
        <group
          key={`drive-wheel-${x}`}
          ref={(node) => {
            wheels.current[index] = node;
          }}
          position={[x, 0.01, side * 0.02]}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.34, 0.34, 0.16, 32]} />
            <meshStandardMaterial color={COLOR.frameLight} {...MATERIAL.frame} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.19, 20]} />
            <meshStandardMaterial color={COLOR.steelBright} {...MATERIAL.steel} />
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
          position={[x, -0.08, side * 0.04]}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.19, 0.19, 0.14, 24]} />
            <meshStandardMaterial color={COLOR.frameLight} {...MATERIAL.frame} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.085, 0.085, 0.17, 18]} />
            <meshStandardMaterial color={COLOR.steelBright} {...MATERIAL.steel} />
          </mesh>
        </group>
      ))}

      {pads.map((index) => {
        const x = -1.03 + index * 0.187;
        return (
          <group key={`track-pad-${index}`}>
            <RoundedBox
              args={[0.15, 0.075, 0.7]}
              radius={0.025}
              smoothness={3}
              position={[x, -0.37, 0]}
              castShadow
            >
              <meshStandardMaterial color={COLOR.rubber} {...MATERIAL.rubber} />
            </RoundedBox>
            <RoundedBox
              args={[0.15, 0.06, 0.66]}
              radius={0.022}
              smoothness={3}
              position={[x, 0.37, 0]}
            >
              <meshStandardMaterial color={COLOR.rubberHighlight} {...MATERIAL.rubber} />
            </RoundedBox>
          </group>
        );
      })}
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
  return (
    <group position={[1.8, -0.08, 0]}>
      <mesh rotation={[0, 0, -0.08]} castShadow>
        <boxGeometry args={[0.16, 0.62, 2.42]} />
        <meshStandardMaterial color={COLOR.frameLight} {...MATERIAL.frame} />
      </mesh>
      <mesh position={[0.08, 0.2, 0]}>
        <boxGeometry args={[0.055, 0.12, 2.28]} />
        <meshStandardMaterial color={COLOR.steelBright} {...MATERIAL.steel} />
      </mesh>
      {[-0.72, 0.72].map((z) => (
        <mesh key={z} position={[-0.42, 0.06, z]} rotation={[0, 0, -0.42]}>
          <boxGeometry args={[0.86, 0.12, 0.13]} />
          <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
        </mesh>
      ))}
    </group>
  );
}

export function PremiumExcavatorBody({
  velRef,
  yanmarLogo,
  ykLogo,
}: {
  velRef: React.MutableRefObject<HydraulicVelocity>;
  yanmarLogo?: THREE.Texture;
  ykLogo?: THREE.Texture;
}) {
  const premiumRearMark = useMemo(() => createYkGeongiMarkTexture(), []);
  useLayoutEffect(() => () => premiumRearMark?.dispose(), [premiumRearMark]);
  const rearMark = premiumRearMark ?? ykLogo;

  return (
    <group scale={[0.58, 1, 0.82]}>
      <group position={[-0.72, 0.24, 0]}>
        {[-1, 1].map((side) => (
          <PremiumTrack key={side} side={side as 1 | -1} velRef={velRef} />
        ))}
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
              <mesh position={[0.43, 0.11, 0]} rotation={[0, side < 0 ? Math.PI : 0, 0]} renderOrder={12}>
                <planeGeometry args={[0.72, 0.087]} />
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
        <mesh position={[-1.445, 1.1, 0]} rotation={[0, -Math.PI / 2, 0]} renderOrder={19}>
          <planeGeometry args={[1.02, 0.357]} />
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
              rotation={[0, 0, logoRotation]}
              scale={[-1, 1, 1]}
              renderOrder={12}
            >
              <planeGeometry args={[logoWidth, logoHeight]} />
              <meshBasicMaterial
                map={logo}
                transparent
                alphaTest={0.3}
                toneMapped={false}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          ) : null}
        </group>
      ))}
      <mesh position={[length * 0.58, height * 0.52, 0]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.035, length * 0.48, 5, 10]} />
        <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
      </mesh>
      <mesh position={[length * 0.58, height * 0.62, 0]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.025, length * 0.44, 5, 10]} />
        <meshStandardMaterial color={COLOR.frameLight} {...MATERIAL.frame} />
      </mesh>
    </group>
  );
}
