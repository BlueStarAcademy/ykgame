"use client";

import { useEffect, useMemo, useState } from "react";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import { StarAmount } from "@/components/StarAmount";
import { XpProgressBar } from "@/components/ui/XpProgressBar";
import type { PlayerLevelProgress } from "@/lib/playerLevel";
import {
  NICKNAME_CHANGE_COST_STARS,
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  nicknameCharLength,
  profileAvatarSrc,
  resolveProfileAvatarId,
  validateNickname,
} from "@/lib/profile";
import { ChassisGallery } from "./ChassisPanel";
import {
  CHASSIS_CATALOG,
  type ChassisModelId,
} from "./chassisCatalog";
import { chassisModelThumbSrc } from "./gearArt";
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
  profileAvatarId: string | null;
  abilityAlloc: AbilityAlloc;
  busy?: boolean;
  onPurchaseChassis: (id: ChassisModelId) => void | Promise<void>;
  onEquipChassis: (id: ChassisModelId) => void | Promise<void>;
  onAbilityAllocChange: (alloc: AbilityAlloc) => void | Promise<void>;
  onProfileUpdated: (result: {
    nickname: string | null;
    profileAvatarId: string | null;
    currency: number;
  }) => void | Promise<void>;
}

function ProfileAvatar({
  avatarId,
  fallbackChassisId,
  size = 48,
}: {
  avatarId: string | null;
  fallbackChassisId?: string;
  size?: number;
}) {
  const src = profileAvatarSrc(avatarId, fallbackChassisId);
  return (
    <div
      className="yanmar-profile-avatar"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={src}
        src={src}
        alt=""
        className="yanmar-profile-avatar-img"
        draggable={false}
      />
    </div>
  );
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function ProfileEditModal({
  open,
  onClose,
  nickname,
  stars,
  profileAvatarId,
  activeChassisId,
  onProfileUpdated,
}: {
  open: boolean;
  onClose: () => void;
  nickname: string;
  stars: number;
  profileAvatarId: string | null;
  activeChassisId: string;
  onProfileUpdated: PlayerProfileModalProps["onProfileUpdated"];
}) {
  const resolvedAvatar = resolveProfileAvatarId(profileAvatarId, activeChassisId);
  const [draftAvatarId, setDraftAvatarId] =
    useState<ChassisModelId>(resolvedAvatar);
  const [draftNickname, setDraftNickname] = useState(nickname);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingNickname, setSavingNickname] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraftAvatarId(resolveProfileAvatarId(profileAvatarId, activeChassisId));
    setDraftNickname(nickname);
    setError("");
  }, [open, profileAvatarId, activeChassisId, nickname]);

  const avatarDirty = draftAvatarId !== resolvedAvatar;
  const nicknameDirty = draftNickname.trim() !== nickname.trim();
  const canAffordNickname = stars >= NICKNAME_CHANGE_COST_STARS;

  async function saveAvatar() {
    if (!avatarDirty) return;
    setError("");
    setSavingAvatar(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileAvatarId: draftAvatarId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "프로필 저장에 실패했습니다.");
        return;
      }
      await onProfileUpdated({
        nickname: data.nickname ?? nickname,
        profileAvatarId: data.profileAvatarId ?? draftAvatarId,
        currency: data.currency,
      });
    } catch {
      setError("프로필 저장에 실패했습니다.");
    } finally {
      setSavingAvatar(false);
    }
  }

  async function saveNickname() {
    const next = draftNickname.trim();
    if (!nicknameDirty) return;
    const parsed = validateNickname(next);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    if (!canAffordNickname) {
      setError(`닉네임 변경에는 스타 ${NICKNAME_CHANGE_COST_STARS}개가 필요합니다.`);
      return;
    }
    setError("");
    setSavingNickname(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: parsed.nickname }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "닉네임 변경에 실패했습니다.");
        return;
      }
      await onProfileUpdated({
        nickname: data.nickname ?? parsed.nickname,
        profileAvatarId: data.profileAvatarId ?? profileAvatarId,
        currency: data.currency,
      });
    } catch {
      setError("닉네임 변경에 실패했습니다.");
    } finally {
      setSavingNickname(false);
    }
  }

  return (
    <AppModalOverlay
      open={open}
      onClose={onClose}
      nested
      panelClassName="!max-w-[min(94vw,28rem)] !h-[min(88dvh,40rem)] !max-h-[min(88dvh,40rem)] !overflow-hidden !p-0"
    >
      <div className="yanmar-profile-edit-modal">
        <div className="yanmar-profile-edit-header">
          <h3>프로필 편집</h3>
          <button type="button" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        <div className="yanmar-profile-edit-body">
          <section className="yanmar-profile-edit-pane yanmar-profile-edit-pane--avatar">
            <div className="yanmar-profile-edit-section-head">
              <h4>프로필 이미지</h4>
              <button
                type="button"
                className="yanmar-profile-edit-apply"
                disabled={!avatarDirty || savingAvatar}
                onClick={() => void saveAvatar()}
              >
                {savingAvatar ? "저장 중..." : "적용"}
              </button>
            </div>
            <div
              className="yanmar-profile-avatar-scroll"
              role="listbox"
              aria-label="차량 디자인"
            >
              <div className="yanmar-profile-avatar-grid">
                {CHASSIS_CATALOG.map((chassis) => {
                  const selected = draftAvatarId === chassis.id;
                  return (
                    <button
                      key={chassis.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      aria-label={chassis.label}
                      title={chassis.label}
                      className={`yanmar-profile-avatar-option${
                        selected ? " is-selected" : ""
                      }`}
                      onClick={() => setDraftAvatarId(chassis.id)}
                    >
                      <span className="yanmar-profile-avatar-frame" aria-hidden>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          key={chassisModelThumbSrc(chassis.id)}
                          src={chassisModelThumbSrc(chassis.id)}
                          alt=""
                          draggable={false}
                        />
                      </span>
                      <span className="yanmar-profile-avatar-label">
                        {chassis.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="yanmar-profile-edit-pane yanmar-profile-edit-pane--nickname">
            <h4>닉네임 변경</h4>
            <input
              type="text"
              value={draftNickname}
              onChange={(e) => setDraftNickname(e.target.value)}
              className="yanmar-profile-edit-nickname"
              placeholder={`닉네임 (${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}글자)`}
              minLength={NICKNAME_MIN_LENGTH}
              maxLength={NICKNAME_MAX_LENGTH}
              aria-label="닉네임"
            />
            <button
              type="button"
              className="yanmar-profile-edit-nickname-btn"
              disabled={
                !nicknameDirty ||
                savingNickname ||
                nicknameCharLength(draftNickname.trim()) < NICKNAME_MIN_LENGTH
              }
              onClick={() => void saveNickname()}
            >
              {savingNickname ? (
                "변경 중..."
              ) : (
                <>
                  <span>변경</span>
                  <StarAmount
                    value={NICKNAME_CHANGE_COST_STARS}
                    size={13}
                    valueClassName="text-[12px] font-black tabular-nums text-amber-100"
                  />
                </>
              )}
            </button>
            {!canAffordNickname && nicknameDirty ? (
              <p className="yanmar-profile-edit-hint">스타가 부족합니다.</p>
            ) : null}
            {error ? <p className="yanmar-profile-edit-error">{error}</p> : null}
          </section>
        </div>
      </div>
    </AppModalOverlay>
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
  profileAvatarId,
  abilityAlloc,
  busy,
  onPurchaseChassis,
  onEquipChassis,
  onAbilityAllocChange,
  onProfileUpdated,
}: PlayerProfileModalProps) {
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (!open) setEditOpen(false);
  }, [open]);

  const avatarFallback = useMemo(
    () => String(activeChassisId),
    [activeChassisId],
  );

  return (
    <>
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
              <div className="yanmar-profile-avatar-wrap">
                <ProfileAvatar
                  avatarId={profileAvatarId}
                  fallbackChassisId={avatarFallback}
                  size={56}
                />
                <button
                  type="button"
                  className="yanmar-profile-edit-pencil"
                  onClick={() => setEditOpen(true)}
                  aria-label="프로필 편집"
                >
                  <PencilIcon />
                </button>
              </div>
              <div className="yanmar-profile-hero-text">
                <p className="yanmar-profile-level-row">
                  <span className="yanmar-profile-level">Lv.{xpProgress.level}</span>
                  <span className="yanmar-profile-name">{nickname}</span>
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

      <ProfileEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        nickname={nickname}
        stars={stars}
        profileAvatarId={profileAvatarId}
        activeChassisId={avatarFallback}
        onProfileUpdated={onProfileUpdated}
      />
    </>
  );
}
