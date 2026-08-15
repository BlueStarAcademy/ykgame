"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import {
  ChatGearInspectModal,
  toChatGearSnapshot,
} from "@/components/games/ChatGearInspectModal";
import { XpProgressBar } from "@/components/ui/XpProgressBar";
import {
  GearEquipStatsPanel,
  type GearEquipStatsItem,
} from "@/games/yanmar/GearEquipStatsPanel";
import { DEFAULT_CHASSIS_ID } from "@/games/yanmar/chassisCatalog";
import { profileAvatarSrc } from "@/lib/profile";
import type { ChatGearSnapshot } from "@/lib/chat/types";
import type { PublicUserProfile } from "@/lib/public-profile";

function ProfileAvatar({
  avatarId,
  nickname,
  size = 56,
}: {
  avatarId: string | null;
  nickname: string;
  size?: number;
}) {
  const src = profileAvatarSrc(avatarId);
  const initial = nickname.trim().charAt(0) || "?";
  return (
    <span
      className="yanmar-profile-avatar"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          className="yanmar-profile-avatar-img"
          draggable={false}
        />
      ) : (
        <span className="yanmar-profile-avatar-initial">{initial}</span>
      )}
    </span>
  );
}

export function ChatUserProfileModal({
  userId,
  fallbackNickname,
  onClose,
}: {
  userId: string;
  fallbackNickname: string;
  onClose: () => void;
}) {
  const t = useTranslations("shell.chat");
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inspect, setInspect] = useState<ChatGearSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProfile(null);
    setInspect(null);

    void fetch(`/api/user/${encodeURIComponent(userId)}/public`)
      .then(async (res) => {
        const data = (await res.json()) as {
          profile?: PublicUserProfile;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.profile) {
          setError(t("profileLoadFailed"));
          return;
        }
        setProfile(data.profile);
      })
      .catch(() => {
        if (!cancelled) setError(t("profileLoadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, t]);

  const displayName = profile?.nickname ?? fallbackNickname;
  const xpProgress = profile
    ? {
        level: profile.level,
        totalXp: profile.totalXp,
        currentXp: profile.currentXp,
        requiredXp: profile.requiredXp,
        progressPct: profile.progressPct,
      }
    : null;

  const handleClose = () => {
    setInspect(null);
    onClose();
  };

  return (
    <>
      <AppModalOverlay
        open
        nested
        onClose={handleClose}
        panelClassName="!h-auto !max-h-[min(90dvh,44rem)] !max-w-[min(96vw,42rem)] !overflow-hidden !p-0"
      >
        <div className="yanmar-profile-modal yanmar-chat-user-profile">
          <div className="yanmar-profile-modal-header">
            <h2>{t("profileTitle")}</h2>
            <div className="yanmar-profile-modal-header-right">
              <button
                type="button"
                onClick={handleClose}
                aria-label={t("close")}
              >
                ×
              </button>
            </div>
          </div>

          <div className="yanmar-profile-modal-body">
            {loading ? (
              <p className="px-3 py-6 text-center text-xs text-amber-200/70">
                {t("profileLoading")}
              </p>
            ) : error || !profile || !xpProgress ? (
              <p className="px-3 py-6 text-center text-xs text-rose-300">
                {error ?? t("profileLoadFailed")}
              </p>
            ) : (
              <>
                <div className="yanmar-profile-hero">
                  <div className="yanmar-profile-avatar-wrap">
                    <ProfileAvatar
                      avatarId={profile.profileAvatarId}
                      nickname={displayName}
                      size={56}
                    />
                  </div>
                  <div className="yanmar-profile-hero-text">
                    <p className="yanmar-profile-level-row">
                      <span className="yanmar-profile-level">
                        Lv.{xpProgress.level}
                      </span>
                      <span className="yanmar-profile-name">{displayName}</span>
                    </p>
                    <XpProgressBar
                      progress={xpProgress}
                      showLabel
                      className="yanmar-profile-xp-bar"
                      barClassName="!h-2.5 bg-white/15"
                      labelClassName="text-[10px] font-bold text-white/75"
                    />
                  </div>
                </div>

                <div className="yanmar-chat-user-profile-gear">
                  <GearEquipStatsPanel
                    items={profile.equippedGear}
                    activeChassisId={
                      profile.activeChassisId || DEFAULT_CHASSIS_ID
                    }
                    selectedItemId={inspect?.itemId ?? null}
                    selectedSlot={
                      inspect ? (inspect.slot as GearEquipStatsItem["slot"]) : null
                    }
                    onSlotClick={(_slot, item) => {
                      if (!item) {
                        setInspect(null);
                        return;
                      }
                      setInspect(toChatGearSnapshot(item));
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </AppModalOverlay>

      {inspect ? (
        <ChatGearInspectModal
          snapshot={inspect}
          nested
          onClose={() => setInspect(null)}
        />
      ) : null}
    </>
  );
}
