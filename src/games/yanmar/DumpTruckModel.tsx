"use client";

import { useLayoutEffect } from "react";
import { RoundedBox, Text } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { YK_GEONGI_LOGO } from "@/lib/brand-assets";
import {
  configureYkGeongiLogoTexture,
  YANMAR_MACHINE_COLORS as COLOR,
  YANMAR_MACHINE_MATERIALS as MATERIAL,
} from "./machineVisualTheme";
import {
  DUMP_TRUCK_BODY_LOCAL_Y,
  DUMP_TRUCK_WHEEL_CENTER_LOCAL_Y,
  DUMP_TRUCK_WHEEL_RADIUS,
} from "./terrain";

const WHEEL_POSITIONS = [
  { x: -2.7, z: -1.46 },
  { x: -1.75, z: -1.46 },
  { x: 2.45, z: -1.46 },
  { x: -2.7, z: 1.46 },
  { x: -1.75, z: 1.46 },
  { x: 2.45, z: 1.46 },
] as const;

function TruckWheel({
  x,
  z,
  index,
  wheelRefs,
}: {
  x: number;
  z: number;
  index: number;
  wheelRefs: React.MutableRefObject<(THREE.Group | null)[]>;
}) {
  return (
    <group position={[x, DUMP_TRUCK_WHEEL_CENTER_LOCAL_Y, z]}>
      <group
        ref={(node) => {
          wheelRefs.current[index] = node;
        }}
      >
        <group rotation={[Math.PI / 2, 0, 0]}>
          <mesh castShadow>
            <cylinderGeometry
              args={[
                DUMP_TRUCK_WHEEL_RADIUS,
                DUMP_TRUCK_WHEEL_RADIUS,
                0.4,
                32,
              ]}
            />
            <meshStandardMaterial color={COLOR.rubber} {...MATERIAL.rubber} />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.3, 0.3, 0.43, 28]} />
            <meshStandardMaterial color={COLOR.steel} {...MATERIAL.steel} />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.13, 0.13, 0.46, 18]} />
            <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
          </mesh>
        </group>
        {Array.from({ length: 12 }, (_, lug) => {
          const rotation = (lug / 12) * Math.PI * 2;
          return (
            <mesh key={lug} rotation={[0, 0, rotation]}>
              <boxGeometry args={[0.075, 0.9, 0.045]} />
              <meshStandardMaterial color={COLOR.rubberHighlight} {...MATERIAL.rubber} />
            </mesh>
          );
        })}
      </group>
      <RoundedBox
        args={[0.96, 0.18, 0.54]}
        radius={0.07}
        smoothness={5}
        position={[0, 0.45, z > 0 ? -0.08 : 0.08]}
      >
        <meshStandardMaterial color={COLOR.frameLight} {...MATERIAL.frame} />
      </RoundedBox>
    </group>
  );
}

function DumpBed({ sideMark }: { sideMark: THREE.Texture | null }) {
  return (
    <group position={[-0.68, 1.05, 0]}>
      <mesh position={[0, -0.36, 0]} rotation={[0, 0, -0.035]} castShadow>
        <boxGeometry args={[4.92, 0.16, 2.52]} />
        <meshStandardMaterial color={COLOR.truckBedDark} {...MATERIAL.paintedDark} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={`bed-side-${side}`} position={[0, 0, side * 1.45]}>
          <mesh castShadow>
            <boxGeometry args={[5.36, 1.42, 0.16]} />
            <meshStandardMaterial color={COLOR.truckBed} {...MATERIAL.painted} />
          </mesh>
          <mesh position={[0, 0.72, side * 0.04]}>
            <boxGeometry args={[5.52, 0.19, 0.23]} />
            <meshStandardMaterial color={COLOR.paintRedBright} {...MATERIAL.painted} />
          </mesh>
          <mesh position={[0, -0.7, side * 0.04]}>
            <boxGeometry args={[5.4, 0.17, 0.23]} />
            <meshStandardMaterial color={COLOR.truckBedDark} {...MATERIAL.paintedDark} />
          </mesh>
          {[-2.25, -1.35, -0.45, 0.45, 1.35, 2.25].map((x) => (
            <group key={`rib-${x}`} position={[x, 0, side * 0.1]}>
              <mesh rotation={[0, 0, -0.08]}>
                <boxGeometry args={[0.14, 1.28, 0.15]} />
                <meshStandardMaterial color={COLOR.paintRedDark} {...MATERIAL.paintedDark} />
              </mesh>
              <mesh position={[0, 0.18, side * 0.085]}>
                <boxGeometry args={[0.055, 0.78, 0.06]} />
                <meshStandardMaterial color={COLOR.paintHighlight} {...MATERIAL.painted} />
              </mesh>
            </group>
          ))}
          {sideMark ? (
            <mesh
              position={[0.15, -0.26, side * 0.115]}
              rotation={[0, side < 0 ? Math.PI : 0, 0]}
              renderOrder={18}
            >
              <planeGeometry args={[1.48, 1.48 / YK_GEONGI_LOGO.aspect]} />
              <meshBasicMaterial
                map={sideMark}
                transparent
                alphaTest={0.16}
                toneMapped={false}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          ) : null}
        </group>
      ))}
      {[-2.68, 2.68].map((x) => (
        <group key={`tail-panel-${x}`} position={[x, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.2, 1.44, 3.04]} />
            <meshStandardMaterial color={COLOR.paintRedDark} {...MATERIAL.paintedDark} />
          </mesh>
          {[-1.08, -0.36, 0.36, 1.08].map((z) => (
            <mesh key={z} position={[x > 0 ? 0.12 : -0.12, 0.48, z]}>
              <boxGeometry args={[0.055, 0.24, 0.4]} />
              <meshStandardMaterial
                color={x > 0 ? COLOR.warning : COLOR.paintRedBright}
                emissive={x > 0 ? "#ff8c1a" : "#7a0909"}
                emissiveIntensity={0.24}
                roughness={0.2}
                metalness={0.15}
              />
            </mesh>
          ))}
        </group>
      ))}
      {[-1, 1].map((side) => (
        <group key={`lift-cylinder-${side}`} position={[1.92, -0.6, side * 1.08]} rotation={[0, 0, -0.48]}>
          <mesh>
            <cylinderGeometry args={[0.11, 0.13, 1.58, 18]} />
            <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
          </mesh>
          <mesh position={[0, 0.62, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 1.1, 16]} />
            <meshStandardMaterial color={COLOR.chrome} {...MATERIAL.steel} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function TruckCab({
  exhaustRef,
}: {
  exhaustRef: React.RefObject<THREE.Mesh | null>;
}) {
  return (
    <group position={[2.32, 0.72, 0]}>
      <RoundedBox args={[1.78, 1.68, 2.48]} radius={0.22} smoothness={9} castShadow>
        <meshStandardMaterial color={COLOR.paintRed} {...MATERIAL.painted} />
      </RoundedBox>
      <RoundedBox args={[1.94, 0.18, 2.62]} radius={0.08} smoothness={6} position={[-0.04, 0.89, 0]} castShadow>
        <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
      </RoundedBox>

      <mesh position={[0.88, 0.17, 0]} castShadow>
        <boxGeometry args={[0.12, 0.74, 1.36]} />
        <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
      </mesh>
      {[-0.45, 0, 0.45].map((z) => (
        <mesh key={`grille-${z}`} position={[0.96, 0.18, z]}>
          <boxGeometry args={[0.055, 0.08, 0.3]} />
          <meshStandardMaterial color={COLOR.steel} {...MATERIAL.steel} />
        </mesh>
      ))}
      <mesh position={[0.5, 0.55, -1.25]}>
        <boxGeometry args={[0.86, 0.64, 0.055]} />
        <meshStandardMaterial color={COLOR.glass} {...MATERIAL.glass} />
      </mesh>
      <mesh position={[0.5, 0.55, 1.25]}>
        <boxGeometry args={[0.86, 0.64, 0.055]} />
        <meshStandardMaterial color={COLOR.glass} {...MATERIAL.glass} />
      </mesh>
      <mesh position={[0.78, 0.6, -0.52]} rotation={[0, -0.12, 0]}>
        <boxGeometry args={[0.06, 0.72, 0.84]} />
        <meshStandardMaterial color={COLOR.glass} {...MATERIAL.glass} />
      </mesh>

      {[-0.48, 0.48].map((z) => (
        <group key={`front-lamp-${z}`} position={[0.96, -0.3, z]}>
          <RoundedBox args={[0.1, 0.3, 0.4]} radius={0.04} smoothness={4}>
            <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
          </RoundedBox>
          <mesh position={[0.06, 0, 0]}>
            <boxGeometry args={[0.025, 0.19, 0.26]} />
            <meshStandardMaterial
              color={COLOR.lamp}
              emissive="#dff5ff"
              emissiveIntensity={0.68}
              roughness={0.12}
              metalness={0.08}
            />
          </mesh>
        </group>
      ))}
      <RoundedBox args={[0.28, 0.34, 2.74]} radius={0.06} smoothness={5} position={[0.88, -0.73, 0]}>
        <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
      </RoundedBox>
      {[-1, 1].map((side) => (
        <group key={`mirror-${side}`} position={[0.32, 0.62, side * 1.48]}>
          <mesh>
            <boxGeometry args={[0.06, 0.42, 0.06]} />
            <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
          </mesh>
          <RoundedBox args={[0.18, 0.34, 0.12]} radius={0.04} smoothness={4} position={[0, 0.2, side * 0.08]}>
            <meshStandardMaterial color="#87b9c7" roughness={0.08} metalness={0.62} />
          </RoundedBox>
        </group>
      ))}
      <mesh ref={exhaustRef} position={[-0.66, 0.88, 1.12]}>
        <cylinderGeometry args={[0.08, 0.11, 0.74, 16]} />
        <meshStandardMaterial
          color={COLOR.frame}
          emissive="#f59e0b"
          emissiveIntensity={0.12}
          {...MATERIAL.frame}
        />
      </mesh>
    </group>
  );
}

export function PremiumDumpTruckModel({
  bodyRef,
  fillMeshRef,
  exhaustRef,
  wheelRefs,
}: {
  bodyRef: React.RefObject<THREE.Group | null>;
  fillMeshRef: React.RefObject<THREE.Mesh | null>;
  exhaustRef: React.RefObject<THREE.Mesh | null>;
  wheelRefs: React.MutableRefObject<(THREE.Group | null)[]>;
}) {
  const ykMark = useLoader(THREE.TextureLoader, YK_GEONGI_LOGO.white);
  const sideMark = ykMark;
  useLayoutEffect(() => {
    configureYkGeongiLogoTexture(ykMark);
  }, [ykMark]);

  return (
    <group ref={bodyRef} position={[0.3, DUMP_TRUCK_BODY_LOCAL_Y, 0]}>
      <RoundedBox args={[5.5, 0.34, 2.74]} radius={0.09} smoothness={6} position={[-0.62, 0.04, 0]} castShadow>
        <meshStandardMaterial color={COLOR.frame} {...MATERIAL.frame} />
      </RoundedBox>
      <mesh position={[-0.72, 0.25, 0]} castShadow>
        <boxGeometry args={[4.98, 0.18, 2.46]} />
        <meshStandardMaterial color={COLOR.frameLight} {...MATERIAL.frame} />
      </mesh>
      <mesh ref={fillMeshRef} visible={false} position={[-0.65, 0.42, 0]}>
        <boxGeometry args={[4.2, 0.12, 2.05]} />
        <meshStandardMaterial color="#795231" roughness={0.96} metalness={0} />
      </mesh>
      <DumpBed sideMark={sideMark} />
      <TruckCab exhaustRef={exhaustRef} />
      {ykMark ? (
        <mesh position={[-3.475, 1.02, 0]} rotation={[0, -Math.PI / 2, 0]} renderOrder={18}>
          <planeGeometry args={[1.92, 1.92 / YK_GEONGI_LOGO.aspect]} />
          <meshBasicMaterial
            map={ykMark}
            transparent
            alphaTest={0.16}
            toneMapped={false}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}
      {WHEEL_POSITIONS.map(({ x, z }, index) => (
        <TruckWheel
          key={`${x}:${z}`}
          x={x}
          z={z}
          index={index}
          wheelRefs={wheelRefs}
        />
      ))}
      <Text
        position={[0.05, 2.72, -1.9]}
        fontSize={0.68}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.035}
        outlineColor={COLOR.paintRedDark}
      >
        DUMP HERE
      </Text>
    </group>
  );
}
