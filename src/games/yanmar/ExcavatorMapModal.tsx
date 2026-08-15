"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import { ExcavatorMinimap } from "./ExcavatorMinimap";
import type { ExcavatorSimState } from "./ExcavatorScene";
import type { TerrainData } from "./terrain";
import type { TutorialStep, TutorialWaypoint } from "./tutorial";
import type { MonumentPhase } from "./monument/types";
import type { WorldPickupsState } from "./worldPickups";

const LEGEND = [
  { labelKey: "legend.dig", tone: "dig" },
  { labelKey: "legend.dump", tone: "dump" },
  { labelKey: "legend.crash", tone: "crash" },
  { labelKey: "legend.hill", tone: "hill" },
  { labelKey: "legend.flood", tone: "flood" },
  { labelKey: "legend.repair", tone: "repair" },
  { labelKey: "legend.monument", tone: "monument" },
  { labelKey: "legend.sports", tone: "sports" },
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
  sportsMeetUnlocked = false,
}: {
  open: boolean;
  onClose: () => void;
  simRef: React.RefObject<ExcavatorSimState>;
  terrainRef: React.RefObject<TerrainData>;
  tutorialStepRef: React.RefObject<TutorialStep | null>;
  tutorialWaypointRef?: React.RefObject<TutorialWaypoint | null>;
  worldPickupsRef?: React.RefObject<WorldPickupsState | null>;
  monumentPhase?: MonumentPhase;
  sportsMeetUnlocked?: boolean;
}) {
  const t = useTranslations("yanmar.map");
  const mapSize = useExpandedMapSize(open);
  const legend = sportsMeetUnlocked
    ? LEGEND
    : LEGEND.filter((item) => item.tone !== "sports");

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
                <p className="yanmar-map-modal-eyebrow">{t("eyebrow")}</p>
                <h2 className="yanmar-map-modal-title">{t("title")}</h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="yanmar-map-modal-close"
              aria-label={t("closeAriaLabel")}
            >
              ✕
            </button>
          </div>
          <p className="yanmar-map-modal-subtitle">
            {t("subtitle")}
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
              sportsMeetUnlocked={sportsMeetUnlocked}
              showLegend={false}
            />
          </div>

          <ul className="yanmar-map-modal-legend" aria-label={t("legendAriaLabel")}>
            {legend.map((item) => (
              <li
                key={item.labelKey}
                className={`yanmar-map-modal-legend-item is-${item.tone}`}
              >
                <span className="yanmar-map-modal-legend-dot" aria-hidden />
                <span>{t(item.labelKey)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppModalOverlay>
  );
}
