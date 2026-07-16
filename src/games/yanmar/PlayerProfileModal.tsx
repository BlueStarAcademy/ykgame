"use client";

import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import { StarAmount } from "@/components/StarAmount";
import { XpProgressBar } from "@/components/ui/XpProgressBar";
import type { PlayerLevelProgress } from "@/lib/playerLevel";
import { ChassisGallery } from "./ChassisPanel";
import type { ChassisModelId } from "./chassisCatalog";
import type { AbilityAlloc } from "./abilityAlloc";

interface PlayerProfileModalProps {
  open: boolean;
  onClose: () => void;
  nickname: string;
  xpProgress: PlayerLevelProgress;
  stars: number;
  playerLevel: number;
  currency: number;
  activeChassisId: ChassisModelId | string;
  ownedChassisIds: string[];
  abilityAlloc: AbilityAlloc;
  busy?: boolean;
  onPurchaseChassis: (id: ChassisModelId) => void | Promise<void>;
  onEquipChassis: (id: ChassisModelId) => void | Promise<void>;
  onAbilityAllocChange: (alloc: AbilityAlloc) => void | Promise<void>;
}

function ProfileAvatar({ nickname, size = 48 }: { nickname: string; size?: number }) {
  const initial = (nickname.trim().charAt(0) || "?").toUpperCase();
  return (
    <div
      className="yanmar-profile-avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-hidden
    >
      {initial}
    </div>
  );
}

export function PlayerProfileModal({
  open,
  onClose,
  nickname,
  xpProgress,
  stars,
  playerLevel,
  currency,
  activeChassisId,
  ownedChassisIds,
  abilityAlloc,
  busy,
  onPurchaseChassis,
  onEquipChassis,
  onAbilityAllocChange,
}: PlayerProfileModalProps) {
  return (
    <AppModalOverlay
      open={open}
      onClose={onClose}
      panelClassName="!max-w-[min(96vw,42rem)] !max-h-[min(94dvh,44rem)] !overflow-hidden !p-0 landscape:!max-h-[min(96dvh,36rem)]"
    >
      <div className="yanmar-profile-modal">
        <div className="yanmar-profile-modal-header">
          <h2>프로필</h2>
          <div className="yanmar-profile-modal-header-right">
            <span className="yanmar-profile-stars">
              <StarAmount
                value={stars}
                size={14}
                valueClassName="text-[12px] font-black tabular-nums text-amber-100"
              />
            </span>
            <button type="button" onClick={onClose} aria-label="닫기">
              ×
            </button>
          </div>
        </div>

        <div className="yanmar-profile-modal-body">
          <div className="yanmar-profile-hero">
            <ProfileAvatar nickname={nickname} size={56} />
            <div className="yanmar-profile-hero-text">
              <p className="yanmar-profile-name">{nickname}</p>
              <p className="yanmar-profile-level">Lv.{xpProgress.level}</p>
              <XpProgressBar
                progress={xpProgress}
                showLabel
                className="yanmar-profile-xp-bar"
                barClassName="!h-2.5 bg-white/15"
                labelClassName="text-[10px] font-bold text-white/75"
              />
            </div>
          </div>

          <h3 className="yanmar-profile-section-title">차체</h3>
          <ChassisGallery
            playerLevel={playerLevel}
            currency={currency}
            activeId={activeChassisId}
            ownedIds={ownedChassisIds}
            busy={busy}
            abilityAlloc={abilityAlloc}
            onPurchase={onPurchaseChassis}
            onEquip={onEquipChassis}
            onAbilityAllocSave={onAbilityAllocChange}
          />
        </div>
      </div>
    </AppModalOverlay>
  );
}
