/**
 * Procedural WAV generator for Yanmar horn SFX.
 * Run: node scripts/generate-yanmar-sounds.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "public", "sounds", "yanmar");
const SAMPLE_RATE = 44100;

fs.mkdirSync(OUT_DIR, { recursive: true });

function clamp(v, min = -1, max = 1) {
  return Math.max(min, Math.min(max, v));
}

function writeWav(filePath, samples, sampleRate = SAMPLE_RATE) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  fs.writeFileSync(filePath, buffer);
}

function envelope(t, attack, hold, release, total) {
  if (t < attack) return t / Math.max(0.0001, attack);
  if (t < attack + hold) return 1;
  if (t < total) {
    const u = (t - attack - hold) / Math.max(0.0001, release);
    return Math.max(0, 1 - u);
  }
  return 0;
}

/**
 * Horn variants:
 * 1 — passenger-car dual-tone
 * 2 — deeper car horn
 * 3 — excavator air horn (sharp)
 * 4 — excavator air horn (piercing short)
 */
function generateHorn(variant) {
  const configs = {
    1: {
      duration: 0.55,
      attack: 0.012,
      hold: 0.32,
      release: 0.2,
      gain: 0.38,
      tones: [
        { f: 400, w: 0.42 },
        { f: 500, w: 0.38 },
        { f: 800, w: 0.08 },
      ],
      grit: 0.04,
      square: 0.12,
    },
    2: {
      duration: 0.62,
      attack: 0.018,
      hold: 0.36,
      release: 0.22,
      gain: 0.4,
      tones: [
        { f: 310, w: 0.4 },
        { f: 390, w: 0.36 },
        { f: 620, w: 0.1 },
      ],
      grit: 0.05,
      square: 0.1,
    },
    3: {
      duration: 0.48,
      attack: 0.006,
      hold: 0.28,
      release: 0.16,
      gain: 0.36,
      tones: [
        { f: 620, w: 0.32 },
        { f: 780, w: 0.28 },
        { f: 980, w: 0.18 },
        { f: 1240, w: 0.1 },
      ],
      grit: 0.1,
      square: 0.28,
      pulse: 18,
    },
    4: {
      duration: 0.36,
      attack: 0.004,
      hold: 0.18,
      release: 0.14,
      gain: 0.34,
      tones: [
        { f: 740, w: 0.3 },
        { f: 920, w: 0.28 },
        { f: 1180, w: 0.2 },
        { f: 1480, w: 0.12 },
      ],
      grit: 0.12,
      square: 0.32,
      pulse: 22,
    },
  };
  const cfg = configs[variant];
  const n = Math.floor(SAMPLE_RATE * cfg.duration);
  const samples = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = envelope(t, cfg.attack, cfg.hold, cfg.release, cfg.duration);
    const slide = 1 - t * 0.015;
    let sig = 0;
    for (const tone of cfg.tones) {
      const f = tone.f * slide;
      sig += Math.sin(2 * Math.PI * f * t) * tone.w;
      if (cfg.square) {
        const sq = Math.sin(2 * Math.PI * f * t) >= 0 ? 1 : -1;
        sig += sq * tone.w * cfg.square * 0.35;
      }
    }
    const flutter = cfg.pulse
      ? 0.88 + 0.12 * Math.sin(2 * Math.PI * cfg.pulse * t)
      : 1;
    const grit = Math.sin(2 * Math.PI * (cfg.tones[0].f * 2.03) * t) * cfg.grit;
    samples[i] = clamp((sig + grit) * env * flutter * cfg.gain);
  }
  return samples;
}

const files = [
  ["horn-1.wav", generateHorn(1)],
  ["horn-2.wav", generateHorn(2)],
  ["horn-3.wav", generateHorn(3)],
  ["horn-4.wav", generateHorn(4)],
];

for (const [name, samples] of files) {
  const out = path.join(OUT_DIR, name);
  writeWav(out, samples);
  console.log(`wrote ${name} (${(fs.statSync(out).size / 1024).toFixed(1)} KB)`);
}

// Remove retired ambient loops if present
for (const name of ["bgm.wav", "workplace.wav"]) {
  const p = path.join(OUT_DIR, name);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log(`removed ${name}`);
  }
}
