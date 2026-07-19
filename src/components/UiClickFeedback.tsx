"use client";

import { useEffect } from "react";
import { yanmarAudio } from "@/games/yanmar/yanmarAudio";

const UI_CLICK_TARGET_SELECTOR = [
  "button",
  '[role="button"]',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
  "a.site-legend-btn",
].join(",");

const UI_CLICK_SKIP_SELECTOR = [
  "[data-no-ui-click]",
  ".yanmar-control-touch-layer",
  ".yanmar-pedal-button",
  ".yanmar-breaker-pedal-button",
  ".yanmar-horn-touch-zone",
  ".yanmar-horn-standalone",
].join(",");

function resolveUiClickTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest(UI_CLICK_TARGET_SELECTOR);
  if (!(el instanceof HTMLElement)) return null;
  if (el.closest(UI_CLICK_SKIP_SELECTOR)) return null;
  if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") {
    return null;
  }
  if (el instanceof HTMLInputElement && el.disabled) return null;
  if (el instanceof HTMLButtonElement && el.disabled) return null;
  return el;
}

/**
 * Global UI click SFX for buttons (capture-phase). Vehicle hold controls are skipped.
 */
export function UiClickFeedback() {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (!resolveUiClickTarget(event.target)) return;
      yanmarAudio.playUiClick();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      if (!resolveUiClickTarget(event.target)) return;
      yanmarAudio.playUiClick();
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  return null;
}
