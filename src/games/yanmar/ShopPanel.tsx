"use client";

import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import { StarAmount } from "@/components/StarAmount";
import { SHOP_ITEMS, type ShopItem } from "./shopCatalog";

interface ShopPanelProps {
  open: boolean;
  onClose: () => void;
  stars?: number;
}

function ShopProductCard({ item }: { item: ShopItem }) {
  return (
    <article className="yanmar-shop-card">
      <div className="yanmar-shop-card-media">
        <img
          src={`${item.imageSrc}?v=1`}
          alt=""
          className="yanmar-shop-card-image"
          draggable={false}
        />
        <h3 className="yanmar-shop-card-title">{item.name}</h3>
      </div>
      <div className="yanmar-shop-card-effect">
        <p className="yanmar-shop-card-effect-main">{item.effect}</p>
        <p className="yanmar-shop-card-effect-time">{item.durationLabel}</p>
      </div>
      <button type="button" className="yanmar-shop-card-buy">
        <StarAmount
          value={item.priceStars}
          size={12}
          valueClassName="yanmar-shop-card-star-value"
        />
        <span className="yanmar-shop-card-buy-label">구매</span>
      </button>
    </article>
  );
}

export function ShopPanel({ open, onClose, stars }: ShopPanelProps) {
  return (
    <AppModalOverlay
      open={open}
      onClose={onClose}
      panelClassName="max-w-[22.5rem] landscape:max-h-[min(94dvh,28rem)]"
    >
      <div className="flex h-[min(84dvh,38rem)] w-full flex-col overflow-hidden rounded-2xl border border-amber-200/20 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl landscape:h-[min(92dvh,26rem)]">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="yanmar-shop-panel-badge" aria-hidden />
            <div>
              <h2 className="text-sm font-black text-amber-100">상점</h2>
              <p className="text-[10px] font-semibold text-white/45">
                YK건기 아이템 샵
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {typeof stars === "number" ? (
              <span className="inline-flex items-center rounded-lg border border-amber-200/20 bg-black/35 px-2 py-1 text-amber-100">
                <StarAmount
                  value={stars}
                  size={12}
                  valueClassName="text-[11px] font-black tabular-nums text-amber-100"
                />
              </span>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-[11px] font-bold text-white/70 hover:bg-white/10 hover:text-white"
            >
              닫기
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 [-webkit-overflow-scrolling:touch]">
          <div className="yanmar-shop-grid">
            {SHOP_ITEMS.map((item) => (
              <ShopProductCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>
    </AppModalOverlay>
  );
}
