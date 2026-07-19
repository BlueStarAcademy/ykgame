"use client";

import { useEffect, useState, type RefObject } from "react";
import {
  SHOP_BUFF_BLINK_REMAINING_MS,
  SHOP_BUFF_FADE_REMAINING_MS,
  type ActiveShopBuff,
  pruneExpiredShopBuffs,
} from "./shopBuffPersistence";
import { SHOP_ITEM_BY_ID, type ShopItemId } from "./shopCatalog";
import type { WorldPickupsState } from "./worldPickups";

interface ActiveShopBuffIconsProps {
  buffs: ActiveShopBuff[];
  onChange: (next: ActiveShopBuff[]) => void;
  /** Street speed buff lives on the world-pickup sim state. */
  worldPickupsRef?: RefObject<WorldPickupsState | null>;
  /** Bumps when world pickups change so street-speed icon updates immediately. */
  worldPickupRevision?: number;
  /** Offset icons below the camera button so they sit beside the map. */
  alignWithMinimap?: boolean;
}

const TIP_VISIBLE_MS = 3000;
const STREET_SPEED_ICON_SRC = "/images/yanmar/2d/street-speed-buff.svg";
const STREET_SPEED_FADE_MS = 10_000;
const STREET_SPEED_BLINK_MS = 5_000;
const MAX_SHOP_ICONS = 5; // +1 street speed slot = 6 max

type TipTarget =
  | { kind: "shop"; id: ShopItemId; key: number }
  | { kind: "street-speed"; key: number };

function formatRemainingMs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function ActiveShopBuffIcons({
  buffs,
  onChange,
  worldPickupsRef,
  worldPickupRevision = 0,
  alignWithMinimap = false,
}: ActiveShopBuffIconsProps) {
  const [now, setNow] = useState(() => Date.now());
  const [tip, setTip] = useState<TipTarget | null>(null);
  const [speedBuffUntilMs, setSpeedBuffUntilMs] = useState(0);

  useEffect(() => {
    const syncStreetSpeed = () => {
      const tick = Date.now();
      const until = worldPickupsRef?.current?.speedBuffUntilMs ?? 0;
      setSpeedBuffUntilMs(until > tick ? until : 0);
    };
    syncStreetSpeed();
    const id = window.setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      const pruned = pruneExpiredShopBuffs(buffs, tick);
      if (pruned.length !== buffs.length) onChange(pruned);
      syncStreetSpeed();
    }, 250);
    return () => window.clearInterval(id);
  }, [buffs, onChange, worldPickupsRef, worldPickupRevision]);

  useEffect(() => {
    if (!tip) return;
    const timer = window.setTimeout(() => setTip(null), TIP_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [tip]);

  const visible = pruneExpiredShopBuffs(buffs, now).slice(0, MAX_SHOP_ICONS);
  const streetRemaining = speedBuffUntilMs > now ? speedBuffUntilMs - now : 0;
  const showStreetSpeed = streetRemaining > 0;

  if (visible.length === 0 && !showStreetSpeed) return null;

  return (
    <ul
      className={`yanmar-active-buff-stack${
        alignWithMinimap ? " is-minimap-aligned" : ""
      }`}
      aria-label="적용 중인 버프"
    >
      {showStreetSpeed ? (
        <li className="yanmar-active-buff-icon">
          <button
            type="button"
            className={`yanmar-active-buff-hit${
              streetRemaining <= STREET_SPEED_FADE_MS &&
              streetRemaining > STREET_SPEED_BLINK_MS
                ? " is-fading"
                : ""
            }${
              streetRemaining <= STREET_SPEED_BLINK_MS ? " is-blinking" : ""
            }`}
            aria-label={`이동속도 2배 남은 시간 ${formatRemainingMs(streetRemaining)}`}
            onClick={() => {
              setTip({ kind: "street-speed", key: Date.now() });
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={STREET_SPEED_ICON_SRC}
              alt=""
              draggable={false}
              aria-hidden
            />
          </button>
          {tip?.kind === "street-speed" ? (
            <span
              key={tip.key}
              className="yanmar-active-buff-tip"
              role="status"
            >
              {formatRemainingMs(streetRemaining)}
            </span>
          ) : null}
        </li>
      ) : null}
      {visible.map((buff) => {
        const item = SHOP_ITEM_BY_ID[buff.id];
        const remaining = buff.expiresAt - now;
        const isBlinking = remaining <= SHOP_BUFF_BLINK_REMAINING_MS;
        const isFading =
          !isBlinking && remaining <= SHOP_BUFF_FADE_REMAINING_MS;
        const showTip = tip?.kind === "shop" && tip.id === buff.id;
        return (
          <li key={buff.id} className="yanmar-active-buff-icon">
            <button
              type="button"
              className={`yanmar-active-buff-hit${
                isFading ? " is-fading" : ""
              }${isBlinking ? " is-blinking" : ""}`}
              aria-label={`${item.name} 남은 시간 ${formatRemainingMs(remaining)}`}
              onClick={() => {
                setTip({ kind: "shop", id: buff.id, key: Date.now() });
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${item.imageSrc}?v=1`}
                alt=""
                draggable={false}
                aria-hidden
              />
            </button>
            {showTip ? (
              <span
                key={tip.key}
                className="yanmar-active-buff-tip"
                role="status"
              >
                {formatRemainingMs(remaining)}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
