#!/usr/bin/env node
// Cross-checks every t("...") call in src against messages/*.json so a missing
// key is caught here instead of rendering its own key path in the UI.
//
// Namespaces are resolved per file: a translator variable can be bound to
// several namespaces across components in one file, so a key counts as missing
// only when none of that variable's namespaces provide it.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const REPORT = process.env.I18N_REPORT ?? '_i18n-report.txt';
const LOCALES = ['ko', 'en', 'ja'];

const BIND = /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*["'`]([^"'`]*)["'`]\s*\)/g;
const CALL = /\b([A-Za-z_$][\w$]*)(?:\.(?:rich|raw|markup|has))?\(\s*(["'])([^"'`${}]+)\2/g;
// Dynamic keys are common for catalog data, e.g.
// `t(\`missionTasks.${task.kind}\`)`. The literal-only pattern above cannot
// see these, which previously let a locale-specific missing entry render its
// own key path in the UI. Check every matching member of the key family.
const TEMPLATE_CALL =
  /\b([A-Za-z_$][\w$]*)(?:\.(?:rich|raw|markup|has))?\(\s*`([^`]*)`/g;

function listSources() {
  const out = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter((rel) => /\.(ts|tsx)$/.test(rel));
}

function flatten(value, prefix, out) {
  if (typeof value === 'string') {
    out.add(prefix);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
  }
}

const keySets = new Map();
for (const locale of LOCALES) {
  const data = JSON.parse(readFileSync(path.join('messages', `${locale}.json`), 'utf8'));
  const keys = new Set();
  flatten(data, '', keys);
  keySets.set(locale, keys);
}

const missing = [];
for (const rel of listSources()) {
  const text = readFileSync(path.join(ROOT, rel), 'utf8');
  if (!text.includes('Translations(')) continue;

  const namespaces = new Map();
  for (const match of text.matchAll(BIND)) {
    const [, variable, namespace] = match;
    if (!namespaces.has(variable)) namespaces.set(variable, new Set());
    namespaces.get(variable).add(namespace);
  }
  if (!namespaces.size) continue;

  for (const match of text.matchAll(CALL)) {
    const [, variable, , key] = match;
    const scopes = namespaces.get(variable);
    if (!scopes) continue;
    const candidates = [...scopes].map((ns) => (ns ? `${ns}.${key}` : key));
    for (const locale of LOCALES) {
      const keys = keySets.get(locale);
      if (candidates.some((candidate) => keys.has(candidate))) continue;
      missing.push({ rel, locale, key: candidates[0], candidates });
    }
  }

  for (const match of text.matchAll(TEMPLATE_CALL)) {
    const [, variable, template] = match;
    const scopes = namespaces.get(variable);
    if (!scopes || !template.includes("${")) continue;

    // Only expand simple dynamic families. Complex interpolation is still
    // runtime-specific and must be covered by a dedicated test.
    const parts = template.split(/\$\{[^}]+\}/);
    if (parts.length !== 2) continue;
    const [prefix, suffix] = parts;

    for (const namespace of scopes) {
      const familyPrefix = namespace ? `${namespace}.${prefix}` : prefix;
      const family = [...keySets.get("ko")]
        .filter(
          (key) =>
            key.startsWith(familyPrefix) &&
            key.endsWith(suffix) &&
            key.length > familyPrefix.length + suffix.length,
        );

      for (const key of family) {
        for (const locale of LOCALES) {
          if (keySets.get(locale).has(key)) continue;
          missing.push({ rel, locale, key, candidates: [key] });
        }
      }
    }
  }
}

const unique = new Map();
for (const item of missing) {
  const id = `${item.locale} ${item.key}`;
  if (!unique.has(id)) unique.set(id, item);
}

const report = [`missing keys: ${unique.size}`, ''];
for (const [id, item] of [...unique.entries()].sort()) {
  report.push(`${id}  (${item.rel}${item.candidates.length > 1 ? `, tried: ${item.candidates.join(' | ')}` : ''})`);
}
writeFileSync(path.join(ROOT, REPORT), report.join('\n'), 'utf8');

console.log(`missing keys: ${unique.size}`);
console.log(`report: ${REPORT}`);
process.exit(unique.size ? 1 : 0);
