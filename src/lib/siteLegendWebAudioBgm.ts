/**
 * Looping BGM via Web Audio — stays inside the page graph and does not
 * surface as a system / browser media-player session (unlike HTMLAudioElement).
 *
 * Autoplay policy: never attach a BufferSource while the AudioContext is
 * suspended. A silent "playing" source would look successful and drop gesture
 * unlock handlers, leaving BGM stuck forever.
 */

import { clearBrowserMediaSession } from "@/lib/clearBrowserMediaSession";

export type SiteLegendWebAudioBgmKind = "login" | "ingame";

type Slot = {
  ctx: AudioContext | null;
  buffer: AudioBuffer | null;
  loading: Promise<AudioBuffer | null> | null;
  source: AudioBufferSourceNode | null;
  gain: GainNode | null;
  srcUrl: string;
};

const SLOTS_KEY = "__ykSiteLegendWebAudioBgmSlots";

type GlobalBag = typeof globalThis & {
  [SLOTS_KEY]?: Partial<Record<SiteLegendWebAudioBgmKind, Slot>>;
};

function bag(): GlobalBag {
  return globalThis as GlobalBag;
}

function slots(): Partial<Record<SiteLegendWebAudioBgmKind, Slot>> {
  const g = bag();
  if (!g[SLOTS_KEY]) g[SLOTS_KEY] = {};
  return g[SLOTS_KEY];
}

function getSlot(kind: SiteLegendWebAudioBgmKind, srcUrl: string): Slot {
  const all = slots();
  const existing = all[kind];
  if (existing && existing.srcUrl === srcUrl) return existing;
  // Swap track without closing AudioContext — closing would drop a running
  // context and force a new suspended one (autoplay-blocked after async work).
  if (existing) {
    disconnectSlotGraph(existing);
    existing.buffer = null;
    existing.loading = null;
    existing.srcUrl = srcUrl;
    return existing;
  }
  const slot: Slot = {
    ctx: null,
    buffer: null,
    loading: null,
    source: null,
    gain: null,
    srcUrl,
  };
  all[kind] = slot;
  return slot;
}

function isRunning(ctx: AudioContext | null | undefined): boolean {
  return ctx?.state === "running";
}

/** Invoke resume() synchronously so a surrounding user-gesture stays valid. */
async function tryResume(ctx: AudioContext): Promise<boolean> {
  const before = ctx.state;
  if (before === "running") return true;
  if (before !== "suspended") return false;
  try {
    await ctx.resume();
  } catch {
    // Autoplay blocked until a real user gesture.
  }
  return ctx.state === "running";
}

async function ensureContext(slot: Slot): Promise<AudioContext | null> {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!slot.ctx || slot.ctx.state === "closed") {
    slot.ctx = new AC();
  }
  await tryResume(slot.ctx);
  return slot.ctx;
}

async function ensureBuffer(slot: Slot): Promise<AudioBuffer | null> {
  if (slot.buffer) return slot.buffer;
  if (slot.loading) return slot.loading;

  slot.loading = (async () => {
    const ctx = await ensureContext(slot);
    if (!ctx) return null;
    try {
      const res = await fetch(slot.srcUrl);
      const data = await res.arrayBuffer();
      const buffer = await ctx.decodeAudioData(data.slice(0));
      slot.buffer = buffer;
      return buffer;
    } catch {
      return null;
    } finally {
      slot.loading = null;
    }
  })();

  return slot.loading;
}

function disconnectSlotGraph(slot: Slot) {
  const source = slot.source;
  const gain = slot.gain;
  slot.source = null;
  slot.gain = null;
  if (source) {
    try {
      source.onended = null;
      source.stop();
    } catch {
      // already stopped
    }
    try {
      source.disconnect();
    } catch {
      // ignore
    }
  }
  if (gain) {
    try {
      gain.disconnect();
    } catch {
      // ignore
    }
  }
}

/** True only when a loop is attached and the context is actually audible. */
export function isWebAudioBgmPlaying(kind: SiteLegendWebAudioBgmKind): boolean {
  const slot = slots()[kind];
  return Boolean(slot?.source && isRunning(slot.ctx));
}

export function getWebAudioBgmSrcUrl(
  kind: SiteLegendWebAudioBgmKind,
): string | null {
  return slots()[kind]?.srcUrl ?? null;
}

export function setWebAudioBgmGain(
  kind: SiteLegendWebAudioBgmKind,
  gain0to1: number,
) {
  const slot = slots()[kind];
  if (!slot?.gain) return;
  slot.gain.gain.value = Math.max(0, Math.min(1, gain0to1));
}

export async function startWebAudioBgm(
  kind: SiteLegendWebAudioBgmKind,
  srcUrl: string,
  gain0to1: number,
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const slot = getSlot(kind, srcUrl);

  // Source exists but context may still be suspended from a blocked autoplay.
  if (slot.source && slot.ctx) {
    setWebAudioBgmGain(kind, gain0to1);
    if (isRunning(slot.ctx)) return true;
    const resumed = await tryResume(slot.ctx);
    if (resumed) return true;
    // Drop the silent graph so a later gesture can start cleanly.
    disconnectSlotGraph(slot);
  }

  const ctx = await ensureContext(slot);
  const buffer = await ensureBuffer(slot);
  if (!ctx || !buffer) return false;

  // Another start may have won while we awaited.
  if (slot.source) {
    setWebAudioBgmGain(kind, gain0to1);
    return isRunning(slot.ctx);
  }

  // Do not attach a BufferSource while autoplay-blocked — that looks "playing"
  // but produces no sound and prevents gesture unlock.
  if (!isRunning(ctx)) {
    const resumed = await tryResume(ctx);
    if (!resumed) return false;
  }

  const gain = ctx.createGain();
  gain.gain.value = Math.max(0, Math.min(1, gain0to1));
  gain.connect(ctx.destination);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(gain);
  try {
    source.start(0);
  } catch {
    try {
      gain.disconnect();
    } catch {
      // ignore
    }
    return false;
  }

  if (!isRunning(ctx)) {
    try {
      source.onended = null;
      source.stop();
    } catch {
      // ignore
    }
    try {
      source.disconnect();
    } catch {
      // ignore
    }
    try {
      gain.disconnect();
    } catch {
      // ignore
    }
    return false;
  }

  slot.gain = gain;
  slot.source = source;
  source.onended = () => {
    if (slot.source === source) {
      slot.source = null;
      slot.gain?.disconnect();
      slot.gain = null;
    }
  };
  clearBrowserMediaSession();
  return true;
}

export function stopWebAudioBgm(
  kind: SiteLegendWebAudioBgmKind,
  disposeContext = false,
) {
  const slot = slots()[kind];
  if (!slot) return;
  disconnectSlotGraph(slot);
  if (disposeContext && slot.ctx) {
    void slot.ctx.close().catch(() => undefined);
    slot.ctx = null;
    slot.buffer = null;
    slot.loading = null;
  }
  clearBrowserMediaSession();
}

export function stopAllWebAudioBgms(opts?: { disposeContext?: boolean }) {
  const dispose = opts?.disposeContext === true;
  stopWebAudioBgm("login", dispose);
  stopWebAudioBgm("ingame", dispose);
  clearBrowserMediaSession();
}

export async function resumeWebAudioBgmContext(
  kind: SiteLegendWebAudioBgmKind,
): Promise<boolean> {
  const slot = slots()[kind];
  if (!slot?.ctx) return false;
  return tryResume(slot.ctx);
}

export async function suspendWebAudioBgmContext(
  kind: SiteLegendWebAudioBgmKind,
) {
  const slot = slots()[kind];
  if (!slot?.ctx) return;
  if (slot.ctx.state === "running") {
    try {
      await slot.ctx.suspend();
    } catch {
      // ignore
    }
  }
}
