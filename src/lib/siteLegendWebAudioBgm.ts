/**
 * Looping BGM via Web Audio — stays inside the page graph and does not
 * surface as a system / browser media-player session (unlike HTMLAudioElement).
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
  if (existing) stopWebAudioBgm(kind, true);
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
  if (slot.ctx.state === "suspended") {
    try {
      await slot.ctx.resume();
    } catch {
      // ignore
    }
  }
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

export function isWebAudioBgmPlaying(kind: SiteLegendWebAudioBgmKind): boolean {
  return Boolean(slots()[kind]?.source);
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
  if (slot.source) {
    setWebAudioBgmGain(kind, gain0to1);
    return true;
  }

  const ctx = await ensureContext(slot);
  const buffer = await ensureBuffer(slot);
  if (!ctx || !buffer) return false;
  // Another start may have won while we awaited.
  if (slot.source) {
    setWebAudioBgmGain(kind, gain0to1);
    return true;
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
) {
  const slot = slots()[kind];
  if (!slot?.ctx) return;
  if (slot.ctx.state === "suspended") {
    try {
      await slot.ctx.resume();
    } catch {
      // ignore
    }
  }
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
