"use client";

import { useLayoutEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import {
  CRASH_ASPHALT_BOX_CENTER_Y,
  CRASH_ASPHALT_BOX_THICKNESS,
  CRASH_ASPHALT_SURFACE_SINK,
  type CrashZone,
  type TerrainData,
  sampleHeight,
} from "./terrain";
import {
  configureSiteTexture,
  PREMIUM_SITE_TEXTURES,
} from "./siteTextures";

export function CrashZoneDecor({
  zone,
  terrain,
}: {
  zone: CrashZone;
  terrain: TerrainData;
}) {
  const loaded = useLoader(THREE.TextureLoader, [
    PREMIUM_SITE_TEXTURES.asphaltAlbedo,
    PREMIUM_SITE_TEXTURES.asphaltNormal,
    PREMIUM_SITE_TEXTURES.asphaltRoughness,
  ]);
  const [albedo, normal, roughness] = useMemo(
    () => loaded.map((texture) => texture.clone()),
    [loaded],
  );
  const normalScale = useMemo(() => new THREE.Vector2(0.45, 0.45), []);
  useLayoutEffect(() => {
    configureSiteTexture(albedo, 2, 2, true);
    configureSiteTexture(normal, 2);
    configureSiteTexture(roughness, 2);
    return () => {
      albedo.dispose();
      normal.dispose();
      roughness.dispose();
    };
  }, [albedo, normal, roughness]);

  const tileWidth = zone.width / 3;
  const tileDepth = zone.depth / 3;
  const ground = sampleHeight(terrain, zone.centerX, zone.centerZ);

  return (
    <group>
      <mesh
        position={[zone.centerX, ground + 0.025, zone.centerZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[zone.width + 5, zone.depth + 5]} />
        <meshStandardMaterial
          map={albedo}
          normalMap={normal}
          normalScale={normalScale}
          roughnessMap={roughness}
          roughness={0.94}
          metalness={0.02}
          color="#596067"
        />
      </mesh>
      {zone.tiles.map((tile) => {
        const damage = 1 - tile.hp / tile.maxHp;
        const x = zone.centerX - zone.width / 2 + tileWidth * (tile.col + 0.5);
        const z = zone.centerZ - zone.depth / 2 + tileDepth * (tile.row + 0.5);
        return (
          <group key={tile.id} position={[x, ground, z]}>
            {tile.active ? (
              <>
                <mesh
                  position={[
                    0,
                    CRASH_ASPHALT_BOX_CENTER_Y - damage * CRASH_ASPHALT_SURFACE_SINK,
                    0,
                  ]}
                  rotation={[0, (tile.row * 3 + tile.col) * 0.025 * damage, damage * 0.02]}
                  receiveShadow
                  castShadow={damage > 0.45}
                >
                  <boxGeometry
                    args={[
                      tileWidth - 0.14,
                      CRASH_ASPHALT_BOX_THICKNESS,
                      tileDepth - 0.14,
                    ]}
                  />
                  <meshStandardMaterial
                    map={albedo}
                    normalMap={normal}
                    roughnessMap={roughness}
                    roughness={0.96}
                    color={damage > 0.65 ? "#3e4448" : "#555b60"}
                  />
                </mesh>
                {damage > 0.1
                  ? Array.from({ length: Math.ceil(damage * 6) }, (_, index) => {
                      const angle = index * 2.399 + tile.row;
                      const radius = 0.9 + index * 0.42;
                      return (
                        <mesh
                          key={index}
                          position={[
                            Math.cos(angle) * radius,
                            0.27,
                            Math.sin(angle) * radius,
                          ]}
                          rotation={[angle * 0.3, angle, angle * 0.15]}
                          scale={[0.5 + damage * 0.45, 0.18, 0.36]}
                          castShadow
                        >
                          <tetrahedronGeometry args={[0.45, 0]} />
                          <meshStandardMaterial color="#30353a" roughness={0.93} />
                        </mesh>
                      );
                    })
                  : null}
                {damage > 0.08 ? (
                  <mesh position={[0, 0.235, 0]} rotation={[-Math.PI / 2, 0, damage * 1.4]}>
                    <ringGeometry args={[1.2 + damage, 1.25 + damage, 24, 1, 0, Math.PI * 1.7]} />
                    <meshBasicMaterial color="#111418" />
                  </mesh>
                ) : null}
                <Billboard position={[0, 2.2, 0]}>
                  <mesh>
                    <planeGeometry args={[3.6, 0.28]} />
                    <meshBasicMaterial color="#111827" transparent opacity={0.72} />
                  </mesh>
                  <mesh position={[-1.8 + 1.8 * (1 - damage), 0, 0.01]}>
                    <planeGeometry args={[3.6 * (1 - damage), 0.18]} />
                    <meshBasicMaterial color={damage < 0.7 ? "#f59e0b" : "#ef4444"} />
                  </mesh>
                </Billboard>
              </>
            ) : (
              <group>
                <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <planeGeometry args={[tileWidth - 0.18, tileDepth - 0.18]} />
                  <meshStandardMaterial color="#55473b" roughness={1} />
                </mesh>
                {Array.from({ length: 9 }, (_, index) => {
                  const angle = index * 1.71;
                  return (
                    <mesh
                      key={index}
                      position={[Math.cos(angle) * (1 + index * 0.25), 0.2, Math.sin(angle) * (1 + index * 0.24)]}
                      scale={[0.62, 0.24, 0.48]}
                      castShadow
                    >
                      <tetrahedronGeometry args={[0.7, 0]} />
                      <meshStandardMaterial color="#34393d" roughness={0.95} />
                    </mesh>
                  );
                })}
              </group>
            )}
          </group>
        );
      })}
      <Text
        position={[zone.centerX, ground + 0.08, zone.centerZ - zone.depth / 2 - 2]}
        rotation={[-Math.PI / 2, 0, Math.PI]}
        fontSize={1.3}
        color="#f8fafc"
        outlineWidth={0.06}
        outlineColor="#111827"
      >
        노면 파쇄 작업구역
      </Text>
    </group>
  );
}
