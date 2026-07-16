/**
 * Rematte chassis portraits: auto-detect corner bg (black or light gray)
 * and punch through to transparent, including enclosed holes.
 *
 * Usage: node scripts/rematte-chassis-black-bg.mjs
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(
  __dirname,
  "../public/images/yanmar/2d/chassis/models",
);
const assetDir =
  "C:/Users/Kang/.cursor/projects/c-project-ykgame/assets";

const IDS = [
  "SV08_1C",
  "SV10",
  "SV11",
  "ViO12_2A",
  "ViO17_1",
  "ViO20_6",
  "ViO23_6",
  "ViO25_6A",
  "ViO35_74",
  "ViO35_7A_CJR",
  "ViO55_6A",
  "ViO80_7",
  "SV100_7",
];

function luma(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function sat(r, g, b) {
  const maxc = Math.max(r, g, b);
  const minc = Math.min(r, g, b);
  return maxc === 0 ? 0 : (maxc - minc) / maxc;
}

function dist(r, g, b, br, bg, bb) {
  const dr = r - br;
  const dg = g - bg;
  const db = b - bb;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function sampleCorners(rgba, width, height) {
  const pts = [
    [2, 2],
    [width - 3, 2],
    [2, height - 3],
    [width - 3, height - 3],
    [width >> 1, 2],
    [2, height >> 1],
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const [x, y] of pts) {
    const o = (y * width + x) * 4;
    r += rgba[o];
    g += rgba[o + 1];
    b += rgba[o + 2];
  }
  const n = pts.length;
  return { r: r / n, g: g / n, b: b / n, L: luma(r / n, g / n, b / n) };
}

function makeBgPred(bg) {
  const lightBg = bg.L > 140;
  return (r, g, b) => {
    if (dist(r, g, b, bg.r, bg.g, bg.b) <= (lightBg ? 42 : 22)) return true;
    const L = luma(r, g, b);
    const S = sat(r, g, b);
    if (lightBg) {
      // light gray / white paper (incl. slight shade variation)
      if (L >= 165 && S < 0.14) return true;
      if (L >= 145 && S < 0.1) return true;
      if (L >= 130 && S < 0.08) return true;
    } else {
      // studio black
      if (r + g + b <= 22) return true;
      if (L <= 26 && S < 0.15) return true;
    }
    return false;
  };
}

function isMachineColor(r, g, b) {
  const L = luma(r, g, b);
  if (r > 70 && r > g * 1.25 && r > b * 1.25) return true;
  if (L > 55 && sat(r, g, b) > 0.08) return true;
  if (L > 70) return true;
  return false;
}

function clearPixel(rgba, i) {
  const o = i * 4;
  rgba[o] = 0;
  rgba[o + 1] = 0;
  rgba[o + 2] = 0;
  rgba[o + 3] = 0;
}

function rematte(rgba, width, height) {
  const bg = sampleCorners(rgba, width, height);
  const lightBg = bg.L > 140;
  const isBg = makeBgPred(bg);
  const n = width * height;

  // Light-gray studio: punch ALL matching bg pixels (ROPS / boom holes
  // are enclosed and won't reach from edges alone).
  if (lightBg) {
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      if (rgba[o + 3] === 0) continue;
      if (isBg(rgba[o], rgba[o + 1], rgba[o + 2])) clearPixel(rgba, i);
    }
  } else {
    const visited = new Uint8Array(n);
    const queue = [];

    const tryEnqueue = (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const i = y * width + x;
      if (visited[i]) return;
      const o = i * 4;
      if (rgba[o + 3] === 0) {
        visited[i] = 1;
        return;
      }
      if (!isBg(rgba[o], rgba[o + 1], rgba[o + 2])) return;
      visited[i] = 1;
      queue.push(i);
    };

    for (let x = 0; x < width; x++) {
      tryEnqueue(x, 0);
      tryEnqueue(x, height - 1);
    }
    for (let y = 0; y < height; y++) {
      tryEnqueue(0, y);
      tryEnqueue(width - 1, y);
    }
    while (queue.length) {
      const i = queue.pop();
      clearPixel(rgba, i);
      const x = i % width;
      const y = (i / width) | 0;
      tryEnqueue(x + 1, y);
      tryEnqueue(x - 1, y);
      tryEnqueue(x, y + 1);
      tryEnqueue(x, y - 1);
    }

    // Grow into enclosed black holes near already-cleared pixels
    for (let pass = 0; pass < 12; pass++) {
      const kill = [];
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const i = y * width + x;
          const o = i * 4;
          if (rgba[o + 3] === 0) continue;
          if (!isBg(rgba[o], rgba[o + 1], rgba[o + 2])) continue;
          let clearN = 0;
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            if (rgba[((y + dy) * width + (x + dx)) * 4 + 3] === 0) clearN++;
          }
          if (clearN >= 1) kill.push(i);
        }
      }
      if (!kill.length) break;
      for (const i of kill) clearPixel(rgba, i);
    }

    // Remaining black islands that don't touch machine colors
    const seen = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (seen[i]) continue;
      const o = i * 4;
      if (rgba[o + 3] === 0 || !isBg(rgba[o], rgba[o + 1], rgba[o + 2])) {
        seen[i] = 1;
        continue;
      }
      const comp = [];
      const q = [i];
      seen[i] = 1;
      let touchesMachine = false;
      while (q.length) {
        const cur = q.pop();
        comp.push(cur);
        const x = cur % width;
        const y = (cur / width) | 0;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          const no = ni * 4;
          if (rgba[no + 3] === 0) continue;
          const nr = rgba[no];
          const ng = rgba[no + 1];
          const nb = rgba[no + 2];
          if (isMachineColor(nr, ng, nb)) {
            touchesMachine = true;
            continue;
          }
          if (seen[ni]) continue;
          if (!isBg(nr, ng, nb)) continue;
          seen[ni] = 1;
          q.push(ni);
        }
      }
      if (!touchesMachine) {
        for (const ci of comp) clearPixel(rgba, ci);
      }
    }
  }

  // Soft contact-shadow fringe: near-transparent dark pixels at edge
  const fringe = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const o = i * 4;
      if (rgba[o + 3] === 0) continue;
      let clearN = 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (rgba[((y + dy) * width + (x + dx)) * 4 + 3] === 0) clearN++;
      }
      if (clearN === 0) continue;
      const r = rgba[o];
      const g = rgba[o + 1];
      const b = rgba[o + 2];
      if (isBg(r, g, b)) {
        fringe.push(i);
        continue;
      }
      // gray-bg soft shadow under tracks
      if (lightBg) {
        const L = luma(r, g, b);
        const S = sat(r, g, b);
        if (clearN >= 2 && L >= 90 && L <= 175 && S < 0.1) fringe.push(i);
      }
    }
  }
  for (const i of fringe) clearPixel(rgba, i);

  // AI sometimes fills ROPS/boom holes with flat black instead of gray.
  // Clear enclosed near-black islands that are NOT part of the track mass.
  if (lightBg) {
    const isFlatDark = (r, g, b) => {
      const L = luma(r, g, b);
      const S = sat(r, g, b);
      return L <= 52 && S < 0.2;
    };
    const seen = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (seen[i]) continue;
      const o = i * 4;
      if (rgba[o + 3] === 0 || !isFlatDark(rgba[o], rgba[o + 1], rgba[o + 2])) {
        seen[i] = 1;
        continue;
      }
      const comp = [];
      const q = [i];
      seen[i] = 1;
      let touchTransparent = false;
      let touchBottom = false;
      let sumL = 0;
      while (q.length) {
        const cur = q.pop();
        comp.push(cur);
        const x = cur % width;
        const y = (cur / width) | 0;
        if (y >= height * 0.68) touchBottom = true;
        const co = cur * 4;
        sumL += luma(rgba[co], rgba[co + 1], rgba[co + 2]);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          const no = ni * 4;
          if (rgba[no + 3] === 0) {
            touchTransparent = true;
            continue;
          }
          if (seen[ni]) continue;
          if (!isFlatDark(rgba[no], rgba[no + 1], rgba[no + 2])) continue;
          seen[ni] = 1;
          q.push(ni);
        }
      }
      if (touchBottom) continue;
      if (comp.length < 40 || comp.length > 12000) continue;
      const meanL = sumL / comp.length;
      // Fully enclosed black fill, or small flat fill hugging cleared gray
      const enclosed = !touchTransparent && meanL <= 48;
      const smallFill =
        touchTransparent && comp.length <= 2500 && meanL <= 28;
      if (enclosed || smallFill) {
        for (const ci of comp) clearPixel(rgba, ci);
      }
    }

    // Tiny residual black wedges between boom / red body / cleared gray
    for (let pass = 0; pass < 4; pass++) {
      const kill = [];
      for (let y = 1; y < Math.floor(height * 0.65); y++) {
        for (let x = 1; x < width - 1; x++) {
          const i = y * width + x;
          const o = i * 4;
          if (rgba[o + 3] === 0) continue;
          const r = rgba[o];
          const g = rgba[o + 1];
          const b = rgba[o + 2];
          const L = luma(r, g, b);
          const S = sat(r, g, b);
          if (!(L <= 38 && S < 0.2)) continue;
          let t = 0;
          let red = 0;
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1],
          ]) {
            const no = ((y + dy) * width + (x + dx)) * 4;
            if (rgba[no + 3] === 0) {
              t++;
              continue;
            }
            if (
              rgba[no] > 70 &&
              rgba[no] > rgba[no + 1] * 1.2 &&
              rgba[no] > rgba[no + 2] * 1.2
            ) {
              red++;
            }
          }
          if (t >= 3 || (t >= 1 && red >= 2)) kill.push(i);
        }
      }
      if (!kill.length) break;
      for (const i of kill) clearPixel(rgba, i);
    }
  }

  return { rgba, bgMode: lightBg ? "gray" : "black" };
}

async function main() {
  console.log(`Rematting ${IDS.length} portraits…`);
  for (const id of IDS) {
    const dest = path.join(dir, `${id}.png`);
    const asset = path.join(assetDir, `${id}.png`);
    const src = fs.existsSync(asset) ? asset : dest;
    const { data, info } = await sharp(src)
      .ensureAlpha()
      .resize(512, 512, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { rgba, bgMode } = rematte(
      Buffer.from(data),
      info.width,
      info.height,
    );
    const tmp = `${dest}.tmp`;
    await sharp(rgba, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png({ compressionLevel: 9 })
      .toFile(tmp);
    fs.renameSync(tmp, dest);
    console.log(
      `  ${id}.png [${bgMode}] (${fs.statSync(dest).size} bytes)`,
    );
  }
  // cleanup qa
  for (const f of fs.readdirSync(dir)) {
    if (f.startsWith("_qa")) fs.unlinkSync(path.join(dir, f));
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
