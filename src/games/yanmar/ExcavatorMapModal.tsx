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

export const MAP_TELEPORT_COST = 10;
export type MapTeleportDestination =
  | "dig"
  | "dump"
  | "crash"
  | "hill"
  | "flood"
  | "repair"
  | "monument"
  | "sports";

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
  stars,
  onTeleport,
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
  stars: number;
  onTeleport: (destination: MapTeleportDestination) => Promise<boolean>;
}) {
  const t = useTranslations("yanmar.map");
  const mapSize = useExpandedMapSize(open);
  const [pendingTeleport, setPendingTeleport] =
    useState<MapTeleportDestination | null>(null);
  const [teleporting, setTeleporting] = useState(false);
  const legend = sportsMeetUnlocked
    ? LEGEND
    : LEGEND.filter((item) => item.tone !== "sports");

  const closeMap = () => {
    setPendingTeleport(null);
    setTeleporting(false);
    onClose();
  };

  const selectedLabel = pendingTeleport
    ? t(`legend.${pendingTeleport}`)
    : "";
  const canTeleport = stars >= MAP_TELEPORT_COST;

  return (
    <AppModalOverlay
      open={open}
      onClose={closeMap}
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
              showRegionLabels={false}
              onSelectDestination={setPendingTeleport}
            />
          </div>

          <ul className="yanmar-map-modal-legend" aria-label={t("legendAriaLabel")}>
            {legend.map((item) => (
              <li
                key={item.labelKey}
                className={`yanmar-map-modal-legend-item is-${item.tone}`}
              >
                <button
                  type="button"
                  className="yanmar-map-modal-legend-button"
                  onClick={() =>
                    setPendingTeleport(item.tone as MapTeleportDestination)
                  }
                >
                  <span className="yanmar-map-modal-legend-dot" aria-hidden />
                  <span>{t(item.labelKey)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {pendingTeleport ? (
        <AppModalOverlay
          open
          onClose={() => !teleporting && setPendingTeleport(null)}
          panelClassName="yanmar-map-teleport-confirm-panel"
          nested
        >
          <div className="yanmar-map-teleport-confirm">
            <p className="yanmar-map-teleport-confirm-eyebrow">{t("teleport.eyebrow")}</p>
            <h3>{t("teleport.title", { destination: selectedLabel })}</h3>
            <p>{t("teleport.description")}</p>
            <div className="yanmar-map-teleport-cost" aria-label={t("teleport.costAria")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/star-currency.svg" alt="" width={24} height={24} />
              <strong>{MAP_TELEPORT_COST}</strong>
            </div>
            {!canTeleport ? (
              <p className="yanmar-map-teleport-insufficient">{t("teleport.insufficient")}</p>
            ) : null}
            <div className="yanmar-map-teleport-actions">
              <button
                type="button"
                onClick={() => setPendingTeleport(null)}
                disabled={teleporting}
              >
                {t("teleport.cancel")}
              </button>
              <button
                type="button"
                disabled={!canTeleport || teleporting}
                onClick={async () => {
                  setTeleporting(true);
                  const succeeded = await onTeleport(pendingTeleport);
                  setTeleporting(false);
                  if (succeeded) {
                    setPendingTeleport(null);
                    closeMap();
                  }
                }}
              >
                {teleporting ? t("teleport.moving") : t("teleport.confirm")}
              </button>
            </div>
          </div>
        </AppModalOverlay>
      ) : null}
    </AppModalOverlay>
  );
}
