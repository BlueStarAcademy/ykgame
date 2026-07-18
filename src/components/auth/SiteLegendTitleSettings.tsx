"use client";

import { useCallback, useState, type RefObject } from "react";
import { RankingBoard } from "@/components/games/RankingBoard";
import { YanmarGuideModal } from "@/games/yanmar/YanmarInfoModals";
import { YanmarGameSettingsMenu } from "@/games/yanmar/YanmarGameSettingsMenu";
import { yanmarAudio } from "@/games/yanmar/yanmarAudio";
import type { HornId } from "@/games/yanmar/soundSettings";
import { useSoundSettings } from "@/games/yanmar/useSoundSettings";

interface SiteLegendTitleSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: RefObject<HTMLElement | null>;
  onLogout?: () => void;
  rankingNickname?: string;
}

export function SiteLegendTitleSettings({
  open,
  onOpenChange,
  anchorRef,
  onLogout,
  rankingNickname,
}: SiteLegendTitleSettingsProps) {
  const [soundSettings, updateSoundSettings] = useSoundSettings();
  const [showMinimap, setShowMinimap] = useState(true);
  const [showMissionQuest, setShowMissionQuest] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);

  const handleToggleBgm = useCallback(() => {
    const bgmEnabled = !soundSettings.bgmEnabled;
    // Persist first so the login BGM singleton sees Off before any unlock/play.
    updateSoundSettings({ bgmEnabled });
    if (bgmEnabled) {
      yanmarAudio.unlock();
    }
  }, [soundSettings.bgmEnabled, updateSoundSettings]);

  return (
    <>
      <YanmarGameSettingsMenu
        immersive={false}
        show
        open={open}
        onOpenChange={onOpenChange}
        anchorRef={anchorRef}
        hideTrigger
        presentation="modal"
        showMinimap={showMinimap}
        onToggleMinimap={() => setShowMinimap((v) => !v)}
        showMissionQuest={showMissionQuest}
        onToggleMissionQuest={() => setShowMissionQuest((v) => !v)}
        bgmEnabled={soundSettings.bgmEnabled}
        onToggleBgm={handleToggleBgm}
        bgmVolume={soundSettings.bgmVolume}
        onBgmVolumeChange={(bgmVolume) => {
          updateSoundSettings({ bgmVolume });
        }}
        sfxEnabled={soundSettings.sfxEnabled}
        onToggleSfx={() => {
          const sfxEnabled = !soundSettings.sfxEnabled;
          updateSoundSettings({ sfxEnabled });
          if (sfxEnabled) yanmarAudio.unlock();
        }}
        sfxVolume={soundSettings.sfxVolume}
        onSfxVolumeChange={(sfxVolume) => {
          updateSoundSettings({ sfxVolume });
        }}
        breakerSfxEnabled={soundSettings.breakerSfxEnabled}
        onToggleBreakerSfx={() => {
          updateSoundSettings({
            breakerSfxEnabled: !soundSettings.breakerSfxEnabled,
          });
        }}
        hornId={soundSettings.hornId}
        onHornIdChange={(hornId: HornId) => {
          updateSoundSettings({ hornId });
          yanmarAudio.setHornId(hornId);
          if (soundSettings.sfxEnabled) {
            yanmarAudio.unlock();
            yanmarAudio.playHorn(hornId);
          }
        }}
        onShowGuide={() => setGuideOpen(true)}
        onShowRanking={() => setRankingOpen(true)}
        onLogout={onLogout}
      />

      <YanmarGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
      <RankingBoard
        gameId="yanmar"
        open={rankingOpen}
        onClose={() => setRankingOpen(false)}
        highlightNickname={rankingNickname}
      />
    </>
  );
}
