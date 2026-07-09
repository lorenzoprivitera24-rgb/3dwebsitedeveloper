#!/usr/bin/env node
/**
 * add-font.mjs — self-host any Google Font into lib/fonts/, GDPR-safe (no runtime CDN).
 *
 * Fonts are fetched at BUILD time from the google-webfonts-helper API and vendored as
 * local woff2 + a self-contained @font-face `font.css` + the family's OFL/Apache license.
 * Sites then import the local CSS; the visitor's browser NEVER contacts Google — which is
 * the whole point (Munich LG ruling 3 O 17493/20: the Google Fonts CDN leaks visitor IPs).
 *
 * Usage:
 *   node scripts/add-font.mjs                      # (re)build the curated shortlist below
 *   node scripts/add-font.mjs inter sora           # add specific families (gwfh ids, kebab-case)
 *   node scripts/add-font.mjs lexend --weights 300,regular,600,900
 *   node scripts/add-font.mjs inter --subsets latin,latin-ext,cyrillic --italics
 *
 * Family ids = the kebab-case slug from fonts.google.com (e.g. "Space Grotesk" -> space-grotesk).
 * Browse ids: https://gwfh.mranftl.com/api/fonts
 */
import { writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const API = 'https://gwfh.mranftl.com/api/fonts';
const RAW = 'https://raw.githubusercontent.com/google/fonts/main';
const KIT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT = join(KIT, 'lib/fonts');

// ---- curated shortlist (modern typefaces for 3D / editorial sites), all OFL ----
const SHORTLIST = {
  Sans: ['inter', 'sora', 'space-grotesk', 'manrope', 'plus-jakarta-sans', 'outfit',
         'dm-sans', 'figtree', 'albert-sans', 'hanken-grotesk', 'onest', 'instrument-sans', 'geist'],
  Display: ['unbounded', 'bricolage-grotesque', 'familjen-grotesk', 'syne', 'fraunces', 'archivo', 'anton'],
  Serif: ['instrument-serif', 'newsreader', 'spectral', 'lora', 'playfair-display'],
  Mono: ['geist-mono', 'jetbrains-mono', 'space-mono', 'fragment-mono', 'ibm-plex-mono'],
};
const ROLE_OF = {};
for (const [role, ids] of Object.entries(SHORTLIST)) for (const id of ids) ROLE_OF[id] = role;

// ---- args ----
const argv = process.argv.slice(2);
const flags = { subsets: 'latin,latin-ext', weights: '300,regular,500,600,700,800', italics: false };
const ids = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--subsets') flags.subsets = argv[++i];
  else if (a === '--weights') flags.weights = argv[++i];
  else if (a === '--italics') flags.italics = true;
  else ids.push(a);
}
const targets = ids.length ? ids : Object.values(SHORTLIST).flat();
const desiredWeights = flags.weights.split(',').map(s => s.trim());
const subsetsFile = flags.subsets.split(',').map(s => s.trim()).join('_'); // filename join uses '_'

const titleCase = (id) => id.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
const slug = (id) => id.replace(/-/g, '');

function parseVariant(v) {
  if (v === 'regular') return { weight: 400, style: 'normal' };
  if (v === 'italic') return { weight: 400, style: 'italic' };
  const m = v.match(/^(\d+)(italic)?$/);
  if (m) return { weight: +m[1], style: m[2] ? 'italic' : 'normal' };
  return null;
}

async function fetchLicense(id) {
  const s = slug(id);
  for (const [path, type] of [
    [`ofl/${s}/OFL.txt`, 'OFL-1.1'],
    [`apache/${s}/LICENSE.txt`, 'Apache-2.0'],
    [`ufl/${s}/UFL.txt`, 'UFL-1.0'],
  ]) {
    const r = await fetch(`${RAW}/${path}`);
    if (r.ok) return { text: await r.text(), type };
  }
  return { text: null, type: 'OFL-1.1 (assumed — verify at fonts.google.com/specimen/' + titleCase(id) + ')' };
}

async function addFont(id) {
  const metaRes = await fetch(`${API}/${id}?subsets=${flags.subsets}`);
  if (!metaRes.ok) { console.log(`  ✗ ${id}: not on gwfh (HTTP ${metaRes.status}) — skipped`); return null; }
  const meta = await metaRes.json();
  const family = meta.family;
  const available = new Set((meta.variants || []).map(v => v.id));

  let want = desiredWeights.filter(w => available.has(w));
  if (flags.italics) want = want.concat(desiredWeights.map(w => w === 'regular' ? 'italic' : `${w}italic`).filter(w => available.has(w)));
  if (!want.length) want = available.has('regular') ? ['regular'] : [[...available][0]];

  const dir = join(OUT, family.replace(/ /g, ''));
  const filesDir = join(dir, 'files');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(filesDir, { recursive: true });

  // download the woff2 zip and unzip locally
  const zipUrl = `${API}/${id}?download=zip&subsets=${flags.subsets}&formats=woff2&variants=${want.join(',')}`;
  const buf = Buffer.from(await (await fetch(zipUrl)).arrayBuffer());
  const tmp = join(tmpdir(), `gwfh-${id}-${want.length}.zip`);
  writeFileSync(tmp, buf);
  execFileSync('unzip', ['-o', '-q', tmp, '-d', filesDir]);
  rmSync(tmp, { force: true });

  // build @font-face css from the actual filenames
  const woffs = readdirSync(filesDir).filter(f => f.endsWith('.woff2')).sort();
  const faces = [];
  for (const f of woffs) {
    const m = f.match(/-([a-z0-9]+)\.woff2$/i);
    const pv = m && parseVariant(m[1]);
    if (!pv) continue;
    faces.push(
      `@font-face {\n  font-family: '${family}';\n  font-style: ${pv.style};\n  font-weight: ${pv.weight};\n  font-display: swap;\n  src: url('./files/${f}') format('woff2');\n}`
    );
  }
  const css = `/* ${family} — self-hosted (Google Fonts via gwfh). No runtime CDN. */\n${faces.join('\n')}\n`;
  writeFileSync(join(dir, 'font.css'), css);

  // license travels with the fonts (OFL requirement)
  const lic = await fetchLicense(id);
  if (lic.text) writeFileSync(join(dir, 'LICENSE.txt'), lic.text);

  const record = {
    id, family, role: ROLE_OF[id] || 'Other', category: meta.category, version: meta.version,
    subsets: flags.subsets.split(','), weights: want, italics: flags.italics,
    license: lic.type, files: woffs.length, source: 'Google Fonts via google-webfonts-helper',
    fetched: new Date().toISOString().slice(0, 10),
  };
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(record, null, 2));
  console.log(`  ✓ ${family.padEnd(22)} ${String(woffs.length).padStart(2)} woff2  [${lic.type}]  ${(record.role)}`);
  return record;
}

console.log(`add-font → ${OUT}\nsubsets=${flags.subsets} weights=${flags.weights} italics=${flags.italics}\nfamilies: ${targets.length}\n`);
mkdirSync(OUT, { recursive: true });
const records = [];
for (const id of targets) {
  try { const r = await addFont(id); if (r) records.push(r); }
  catch (e) { console.log(`  ✗ ${id}: ${e.message}`); }
}
console.log(`\nDone: ${records.length}/${targets.length} families vendored.`);
