"use client";

import { useMemo } from "react";
import type { SportsMeetPattern } from "./sportsMeet/patterns";
import { getSportsMeetTrackSegments } from "./sportsMeet/patterns";
import type { SitePoint } from "./siteLayout";

function TrackLane({
  from,
  to,
  width,
  y,
  color,
}: {
  from: SitePoint;
  to: SitePoint;
  width: number;
  y: number;
  color: string;
}) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  if (length < 0.2) return null;
  const angle = Math.atan2(to[0] - from[0], to[1] - from[1]);
  const cx = (from[0] + to[0]) / 2;
  const cz = (from[1] + to[1]) / 2;
  return (
    <mesh position={[cx, y, cz]} rotation={[0, angle, 0]} receiveShadow>
      <boxGeometry args={[width, 0.05, length]} />
      <meshStandardMaterial
        color={color}
        roughness={0.92}
        metalness={0.04}
      />
    </mesh>
  );
}

/** Painted linear course for the sports-meet arena. */
export function SportsMeetCourseDecor({
  pattern,
}: {
  pattern: SportsMeetPattern;
}) {
  const segments = useMemo(
    () => getSportsMeetTrackSegments(pattern),
    [pattern],
  );

  return (
    <group>
      {segments.map((seg, i) => (
        <group key={`sports-track-${i}`}>
          <TrackLane
            from={seg.from}
            to={seg.to}
            width={7.2}
            y={0.708}
            color="#5c6b4a"
          />
          <TrackLane
            from={seg.from}
            to={seg.to}
            width={5.4}
            y={0.714}
            color="#c4a45a"
          />
          <TrackLane
            from={seg.from}
            to={seg.to}
            width={0.28}
            y={0.72}
            color="#f4f0e4"
          />
        </group>
      ))}
      {/* Zone pads */}
      <mesh
        position={[pattern.zones.dig[0], 0.705, pattern.zones.dig[1]]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[11, 40]} />
        <meshStandardMaterial color="#8b6a3c" roughness={0.95} />
      </mesh>
      <mesh
        position={[pattern.zones.crash[0], 0.705, pattern.zones.crash[1]]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[14, 40]} />
        <meshStandardMaterial color="#4a4f55" roughness={0.9} />
      </mesh>
      <mesh
        position={[pattern.zones.hill[0], 0.72, pattern.zones.hill[1]]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[16, 40]} />
        <meshStandardMaterial color="#6d5a48" roughness={0.94} />
      </mesh>
    </group>
  );
}
