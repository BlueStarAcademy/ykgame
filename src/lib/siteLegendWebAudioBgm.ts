/**
 * Looping BGM via Web Audio — stays inside the page graph and does not
 * surface as a system / browser media-player session (unlike HTMLAudioElement).
 *
 * Autoplay policy: never attach a BufferSource while the AudioContext is
 * suspended. A silent "playing" source would look successful and drop gesture
 * unlock handlers, leaving BGM stuck forever.
 *
 * Call `primeWebAudioBgmContext` synchronously inside a user gesture so later
 * async decode/start can attach sources on an already-running context.
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
  /** Bumped when the wanted track changes or a newer start supersedes. */
  startGen: number;
};

const SLOTS_KEY = "__ykSiteLegendWebAudioBgmSlots";
const BUFFER_CACHE_KEY = "__ykSiteLegendWebAudioBgmBuffers";

type GlobalBag = typeof globalThis & {
  [SLOTS_KEY]?: Partial<Record<SiteLegendWebAudioBgmKind, Slot>>;
  [BUFFER_CACHE_KEY]?: Map<string, AudioBuffer>;
};

function bag(): GlobalBag {
  return globalThis as GlobalBag;
}

function slots(): Partial<Record<SiteLegendWebAudioBgmKind, Slot>> {
  const g = bag();
  if (!g[SLOTS_KEY]) g[SLOTS_KEY] = {};
  return g[SLOTS_KEY];
}

function bufferCache(): Map<string, AudioBuffer> {
  const g = bag();
  if (!g[BUFFER_CACHE_KEY]) g[BUFFER_CACHE_KEY] = new Map();
  return g[BUFFER_CACHE_KEY];
}

function createSlot(srcUrl = ""): Slot {
  return {
    ctx: null,
    buffer: null,
    loading: null,
    source: null,
    gain: null,
    srcUrl,
    startGen: 0,
  };
}

function getOrCreateSlot(kind: SiteLegendWebAudioBgmKind): Slot {
  const all = slots();
  const existing = all[kind];
  if (existing) return existing;
  const slot = createSlot();
  all[kind] = slot;
  return slot;
}

function getSlot(kind: SiteLegendWebAudioBgmKind, srcUrl: string): Slot {
  const slot = getOrCreateSlot(kind);
  if (slot.srcUrl === srcUrl) {
    const cached = bufferCache().get(srcUrl);
    if (cached && !slot.buffer) slot.buffer = cached;
    return slot;
  }
  // Swap track without closing AudioContext — closing would drop a running
  // context and force a new suspended one (autoplay-blocked after async work).
  disconnectSlotGraph(slot);
  slot.startGen += 1;
  slot.srcUrl = srcUrl;
  slot.buffer = bufferCache().get(srcUrl) ?? null;
  slot.loading = null;
  return slot;
}

function isRunning(ctx: AudioContext | null | undefined): boolean {
  return ctx?.state === "running";
}

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext ||
    null
  );
}

/**
 * Create + resume the kind's AudioContext on the current call stack.
 * Must run inside a user gesture for browsers that block autoplay.
 */
export function primeWebAudioBgmContext(
  kind: SiteLegendWebAudioBgmKind,
): boolean {
  const AC = getAudioContextCtor();
  if (!AC) return false;
  const slot = getOrCreateSlot(kind);
  if (!slot.ctx || slot.ctx.state === "closed") {
    slot.ctx = new AC();
  }
  if (slot.ctx.state === "suspended") {
    // Fire resume while the gesture stack is still live (do not await).
    void slot.ctx.resume().catch(() => undefined);
  }
  return isRunning(slot.ctx);
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
  const AC = getAudioContextCtor();
  if (!AC) return null;
  if (!slot.ctx || slot.ctx.state === "closed") {
    slot.ctx = new AC();
  }
  await tryResume(slot.ctx);
  return slot.ctx;
}

async function decodeToCache(
  ctx: AudioContext,
  srcUrl: string,
): Promise<AudioBuffer | null> {
  const cache = bufferCache();
  const hit = cache.get(srcUrl);
  if (hit) return hit;
  try {
    const res = await fetch(srcUrl);
    const data = await res.arrayBuffer();
    const buffer = await ctx.decodeAudioData(data.slice(0));
    cache.set(srcUrl, buffer);
    return buffer;
  } catch {
    return null;
  }
}

async function ensureBuffer(slot: Slot): Promise<AudioBuffer | null> {
  if (!slot.srcUrl) return null;
  const cached = bufferCache().get(slot.srcUrl);
  if (cached) {
    slot.buffer = cached;
    return cached;
  }
  if (slot.buffer) return slot.buffer;
  if (slot.loading) return slot.loading;

  const wantedUrl = slot.srcUrl;
  const gen = slot.startGen;
  slot.loading = (async () => {
    const ctx = await ensureContext(slot);
    if (!ctx) return null;
    const buffer = await decodeToCache(ctx, wantedUrl);
    if (gen !== slot.startGen || slot.srcUrl !== wantedUrl) {
      return bufferCache().get(slot.srcUrl) ?? null;
    }
    slot.buffer = buffer;
    return buffer;
  })().finally(() => {
    if (slot.srcUrl === wantedUrl) {
      slot.loading = null;
    }
  });

  return slot.loading;
}

/**
 * Decode a track ahead of time without interrupting the currently playing URL.
 */
export async function preloadWebAudioBgm(
  kind: SiteLegendWebAudioBgmKind,
  srcUrl: string,
): Promise<boolean> {
  if (typeof window === "undefined" || !srcUrl) return false;
  if (bufferCache().has(srcUrl)) return true;
  const slot = getOrCreateSlot(kind);
  const ctx = await ensureContext(slot);
  if (!ctx) return false;
  const buffer = await decodeToCache(ctx, srcUrl);
  if (buffer && slot.srcUrl === srcUrl) {
    slot.buffer = buffer;
  }
  return Boolean(buffer);
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
  const url = slots()[kind]?.srcUrl;
  return url ? url : null;
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
  const myGen = slot.startGen;

  // Source exists but context may still be suspended from a blocked autoplay.
  if (slot.source && slot.ctx) {
    setWebAudioBgmGain(kind, gain0to1);
    if (isRunning(slot.ctx)) return true;
    const resumed = await tryResume(slot.ctx);
    if (myGen !== slot.startGen) return false;
    if (resumed) return true;
    // Drop the silent graph so a later gesture can start cleanly.
    disconnectSlotGraph(slot);
  }

  const ctx = await ensureContext(slot);
  if (myGen !== slot.startGen) return false;
  const buffer = await ensureBuffer(slot);
  if (myGen !== slot.startGen) return false;
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
    if (myGen !== slot.startGen) return false;
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

  if (myGen !== slot.startGen) {
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
    slot.startGen += 1;
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
