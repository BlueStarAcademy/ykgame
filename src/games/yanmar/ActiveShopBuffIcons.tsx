"use client";

import { useEffect, useState } from "react";
import {
  SHOP_BUFF_BLINK_REMAINING_MS,
  SHOP_BUFF_FADE_REMAINING_MS,
  type ActiveShopBuff,
  pruneExpiredShopBuffs,
} from "./shopBuffPersistence";
import { SHOP_ITEM_BY_ID, type ShopItemId } from "./shopCatalog";

interface ActiveShopBuffIconsProps {
  buffs: ActiveShopBuff[];
  onChange: (next: ActiveShopBuff[]) => void;
}

const TIP_VISIBLE_MS = 3000;

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
}: ActiveShopBuffIconsProps) {
  const [now, setNow] = useState(() => Date.now());
  const [tip, setTip] = useState<{ id: ShopItemId; key: number } | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      const pruned = pruneExpiredShopBuffs(buffs, tick);
      if (pruned.length !== buffs.length) onChange(pruned);
    }, 250);
    return () => window.clearInterval(id);
  }, [buffs, onChange]);

  useEffect(() => {
    if (!tip) return;
    const timer = window.setTimeout(() => setTip(null), TIP_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [tip]);

  const visible = pruneExpiredShopBuffs(buffs, now).slice(0, 6);
  if (visible.length === 0) return null;

  return (
    <ul
      className="yanmar-active-buff-stack"
      aria-label="적용 중인 상점 버프"
    >
      {visible.map((buff) => {
        const item = SHOP_ITEM_BY_ID[buff.id];
        const remaining = buff.expiresAt - now;
        const isBlinking = remaining <= SHOP_BUFF_BLINK_REMAINING_MS;
        const isFading =
          !isBlinking && remaining <= SHOP_BUFF_FADE_REMAINING_MS;
        const showTip = tip?.id === buff.id;
        return (
          <li key={buff.id} className="yanmar-active-buff-icon">
            <button
              type="button"
              className={`yanmar-active-buff-hit${
                isFading ? " is-fading" : ""
              }${isBlinking ? " is-blinking" : ""}`}
              aria-label={`${item.name} 남은 시간 ${formatRemainingMs(remaining)}`}
              onClick={() => {
                setTip({ id: buff.id, key: Date.now() });
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
