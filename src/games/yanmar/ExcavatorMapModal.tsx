"use client";

import { useEffect, useState } from "react";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import { ExcavatorMinimap } from "./ExcavatorMinimap";
import type { ExcavatorSimState } from "./ExcavatorScene";
import type { TerrainData } from "./terrain";
import type { TutorialStep, TutorialWaypoint } from "./tutorial";
import type { MonumentPhase } from "./monument/types";
import type { WorldPickupsState } from "./worldPickups";

const LEGEND = [
  { label: "흙더미", tone: "dig" },
  { label: "하역", tone: "dump" },
  { label: "파쇄", tone: "crash" },
  { label: "석재", tone: "hill" },
  { label: "정비", tone: "repair" },
  { label: "조형", tone: "monument" },
] as const;

function useExpandedMapSize(open: boolean) {
  const [size, setSize] = useState(288);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const landscape = vw > vh;
      const next = landscape
        ? Math.min(vw * 0.4, vh * 0.68, 300)
        : Math.min(vw - 48, vh * 0.5, 340);
      setSize(Math.round(Math.max(232, next)));
    };
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [open]);

  return size;
}

export function ExcavatorMapModal({
  open,
  onClose,
  simRef,
  terrainRef,
  tutorialStepRef,
  tutorialWaypointRef,
  worldPickupsRef,
  monumentPhase = "locked",
}: {
  open: boolean;
  onClose: () => void;
  simRef: React.RefObject<ExcavatorSimState>;
  terrainRef: React.RefObject<TerrainData>;
  tutorialStepRef: React.RefObject<TutorialStep | null>;
  tutorialWaypointRef?: React.RefObject<TutorialWaypoint | null>;
  worldPickupsRef?: React.RefObject<WorldPickupsState | null>;
  monumentPhase?: MonumentPhase;
}) {
  const mapSize = useExpandedMapSize(open);

  return (
    <AppModalOverlay
      open={open}
      onClose={onClose}
      panelClassName="yanmar-map-modal-panel"
    >
      <div className="yanmar-map-modal">
        <header className="yanmar-map-modal-header">
          <div className="yanmar-map-modal-header-glow" aria-hidden />
          <div className="yanmar-map-modal-header-grid" aria-hidden />
          <div className="yanmar-map-modal-header-top">
            <div className="yanmar-map-modal-brand">
              <span className="yanmar-map-modal-compass" aria-hidden>
                <span className="yanmar-map-modal-compass-n">N</span>
              </span>
              <div className="min-w-0">
                <p className="yanmar-map-modal-eyebrow">Site Survey</p>
                <h2 className="yanmar-map-modal-title">현장 맵</h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="yanmar-map-modal-close"
              aria-label="맵 닫기"
            >
              ✕
            </button>
          </div>
          <p className="yanmar-map-modal-subtitle">
            빨간 화살표가 현재 위치와 진행 방향입니다
          </p>
        </header>

        <div className="yanmar-map-modal-body">
          <div
            className="yanmar-map-modal-stage"
            style={{ width: mapSize, height: mapSize }}
          >
            <div className="yanmar-map-modal-stage-ring" aria-hidden />
            <ExcavatorMinimap
              simRef={simRef}
              terrainRef={terrainRef}
              tutorialStepRef={tutorialStepRef}
              tutorialWaypointRef={tutorialWaypointRef}
              worldPickupsRef={worldPickupsRef}
              visible={open}
              embedded
              displaySize={mapSize}
              monumentPhase={monumentPhase}
              showLegend={false}
            />
          </div>

          <ul className="yanmar-map-modal-legend" aria-label="맵 범례">
            {LEGEND.map((item) => (
              <li
                key={item.label}
                className={`yanmar-map-modal-legend-item is-${item.tone}`}
              >
                <span className="yanmar-map-modal-legend-dot" aria-hidden />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppModalOverlay>
  );
}
