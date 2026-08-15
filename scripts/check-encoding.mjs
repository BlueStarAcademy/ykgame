#!/usr/bin/env node
// Fails when tracked text carries broken characters: invalid UTF-8, U+FFFD,
// latin1 mojibake, or '?' placeholders left behind when a non-UTF-8 encoder
// dropped Korean/Japanese text (see messages/*.json, Aug 2026).
//
// Console output stays ASCII-only on purpose: a cp949 terminal would otherwise
// turn clean Korean into '?' and produce false alarms. Details go to a UTF-8
// report file instead.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const REPORT = process.env.ENCODING_REPORT ?? '_enc-report.txt';
const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.scss',
  '.md', '.mdx', '.html', '.svg', '.yml', '.yaml', '.prisma', '.sql',
]);
const SKIP_DIRS = ['node_modules', '.next', 'dist', 'build', '.git', 'coverage'];
const LOCALE_FILES = /^messages[\\/].+\.json$/;

function listFiles() {
  const out = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((rel) => TEXT_EXT.has(path.extname(rel).toLowerCase()))
    .filter((rel) => !SKIP_DIRS.some((dir) => rel.split('/').includes(dir)));
}

const strict = new TextDecoder('utf-8', { fatal: true });
const loose = new TextDecoder('utf-8');

const LATIN1_ARTIFACT = /[\u00C2-\u00F4][\u0080-\u00BF]{2}/;
const LOST_RUN = /(['"`])[^'"`\n]*(\?{3,}|[\u25A1\uFFFD]{2,})[^'"`\n]*\1/;

const findings = [];
const add = (rel, line, hit, text) => findings.push({ rel, line, hit, text });

// A '?' that closes a question sits right after a word or a {placeholder} and
// is followed by nothing, whitespace, or a closing bracket. Every other '?' in
// a locale value is a character the encoder dropped.
const REAL_QUESTION_MARK = /(?<=[\p{L}\p{N}}])\?(?=$|[\s"'\u2019\]})\u300d\u300f\uff09\u3011\u3009\u300b])/gu;

function checkLocaleValues(rel, text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    add(rel, 0, 'invalid-json', String(error.message));
    return;
  }
  const walk = (node, keyPath) => {
    if (typeof node === 'string') {
      if (!node.includes('?')) return;
      if (!node.replace(REAL_QUESTION_MARK, '').includes('?')) return;
      add(rel, 0, 'locale-placeholder', `${keyPath} = ${JSON.stringify(node)}`);
      return;
    }
    if (node && typeof node === 'object') {
      for (const [key, child] of Object.entries(node)) {
        walk(child, keyPath ? `${keyPath}.${key}` : key);
      }
    }
  };
  walk(data, '');
}

for (const rel of listFiles()) {
  let buf;
  try {
    buf = readFileSync(path.join(ROOT, rel));
  } catch {
    continue;
  }
  if (buf.includes(0)) continue;

  try {
    strict.decode(buf);
  } catch {
    add(rel, 0, 'invalid-utf8-bytes', '');
  }
  const text = loose.decode(buf);

  text.split(/\r?\n/).forEach((line, idx) => {
    if (line.includes('\uFFFD')) add(rel, idx + 1, 'U+FFFD', line.trim().slice(0, 200));
    if (LATIN1_ARTIFACT.test(line)) add(rel, idx + 1, 'latin1-mojibake', line.trim().slice(0, 200));
    if (LOST_RUN.test(line)) add(rel, idx + 1, 'lost-text-run', line.trim().slice(0, 200));
  });

  if (LOCALE_FILES.test(rel)) checkLocaleValues(rel, text);
}

const byFile = new Map();
for (const finding of findings) {
  if (!byFile.has(finding.rel)) byFile.set(finding.rel, []);
  byFile.get(finding.rel).push(finding);
}

const report = [`files with findings: ${byFile.size}`, `findings: ${findings.length}`, ''];
for (const [rel, items] of [...byFile.entries()].sort()) {
  report.push(`${rel}  (${items.length})`);
  for (const item of items) report.push(`  L${item.line} [${item.hit}] ${item.text}`);
  report.push('');
}
writeFileSync(path.join(ROOT, REPORT), report.join('\n'), 'utf8');

console.log(`files with findings: ${byFile.size}`);
console.log(`findings: ${findings.length}`);
console.log(`report: ${REPORT}`);
process.exit(byFile.size ? 1 : 0);
