/**
 * Stops page audio when the tab is hidden, frozen, or closing.
 *
 * Important: after pagehide we do NOT auto-resume on pageshow — that was
 * restarting BGM while Chrome kept the page alive in the background.
 * Resume only when the tab is visibly focused again (and hooks allow it).
 */

import { killAllSiteLegendBgms } from "@/lib/siteLegendBgmRegistry";

export type PageAudioHooks = {
  /** Tab hidden (alt-tab / other tab) — pause, keep ready to resume. */
  pause: () => void;
  /** Tab visible again — resume only if settings/screen still want audio. */
  resume: () => void;
  /** Document unloading or frozen — hard stop and release media. */
  exit: () => void;
};

const GLOBAL_KEY = "__ykPageAudioLifecycle";
const SEALED_KEY = "__ykPageAudioSealed";

type GlobalBag = typeof globalThis & {
  [GLOBAL_KEY]?: {
    hooks: Map<string, PageAudioHooks>;
    installed: boolean;
  };
  [SEALED_KEY]?: boolean;
};

function bag(): GlobalBag {
  return globalThis as GlobalBag;
}

function state() {
  const g = bag();
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = { hooks: new Map(), installed: false };
  }
  return g[GLOBAL_KEY];
}

function forEachHook(fn: (hooks: PageAudioHooks) => void) {
  for (const hooks of state().hooks.values()) {
    try {
      fn(hooks);
    } catch {
      // ignore listener errors
    }
  }
}

function sealPageAudio() {
  bag()[SEALED_KEY] = true;
}

function unsealPageAudio() {
  bag()[SEALED_KEY] = false;
}

/** True after pagehide/freeze until the tab is visibly focused again. */
export function isPageAudioSealed(): boolean {
  return bag()[SEALED_KEY] === true;
}

function install() {
  if (typeof window === "undefined") return;
  const s = state();
  if (s.installed) return;
  s.installed = true;

  const onExit = () => {
    sealPageAudio();
    killAllSiteLegendBgms({ unload: true });
    forEachHook((h) => h.exit());
  };

  const onVis = () => {
    if (document.visibilityState === "hidden") {
      forEachHook((h) => h.pause());
      killAllSiteLegendBgms({ unload: false });
      return;
    }
    // Visible again — allow controllers to resume only if still wanted.
    unsealPageAudio();
    forEachHook((h) => h.resume());
  };

  window.addEventListener("pagehide", onExit);
  window.addEventListener("beforeunload", onExit);
  // Do NOT resume on pageshow — bfcache/background restore was restarting BGM.
  document.addEventListener("visibilitychange", onVis);
  document.addEventListener("freeze", onExit);
}

/** Register or replace hooks for a named audio system (HMR-safe). */
export function registerPageAudioHooks(
  id: string,
  hooks: PageAudioHooks,
): () => void {
  install();
  const s = state();
  s.hooks.set(id, hooks);
  return () => {
    if (s.hooks.get(id) === hooks) s.hooks.delete(id);
  };
}
