#!/usr/bin/env node
/**
 * gen-illustrations.mjs — generate a deterministic, fully-offline SVG illustration shelf
 * from DiceBear styles (Open Peeps, Notionists, Lorelei, Avataaars, Bottts, Croodles, …).
 *
 * Every SVG is generated locally at build time — no runtime CDN, GDPR-safe. Seeds are fixed
 * so re-running reproduces the same set. Each style folder carries a meta.json with the
 * style's real license + creator (read from the DiceBear style metadata), so attribution is
 * always correct.
 *
 * Usage:
 *   node scripts/gen-illustrations.mjs                 # all styles, 24 variants each
 *   node scripts/gen-illustrations.mjs --count 40      # more variants per style
 *   node scripts/gen-illustrations.mjs openPeeps lorelei --count 60   # specific styles
 */
import { createAvatar } from '@dicebear/core';
import * as C from '@dicebear/collection';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT = join(KIT, 'lib/illustrations/dicebear');

const argv = process.argv.slice(2);
let count = 24;
const picked = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--count') count = parseInt(argv[++i], 10) || count;
  else picked.push(argv[i]);
}
const styles = picked.length ? picked : Object.keys(C);
const kebab = (n) => n.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

mkdirSync(OUT, { recursive: true });
const manifest = [];
for (const name of styles) {
  const style = C[name];
  if (!style) { console.log(`  ✗ ${name}: not a DiceBear style — skipped`); continue; }
  const slug = kebab(name);
  const dir = join(OUT, slug);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (let i = 1; i <= count; i++) {
    const svg = createAvatar(style, { seed: `${slug}-${String(i).padStart(2, '0')}`, size: 200 }).toString();
    writeFileSync(join(dir, `${slug}-${String(i).padStart(2, '0')}.svg`), svg);
  }
  const m = style.meta || {};
  const record = {
    style: slug, title: m.title || name, creator: m.creator || 'unknown',
    source: m.source || null, homepage: m.homepage || null,
    license: m.license || { name: 'unknown', url: null }, count,
  };
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(record, null, 2));
  manifest.push(record);
  console.log(`  ✓ ${record.title.padEnd(20)} ${String(count).padStart(3)} svg  [${record.license.name}]  — ${record.creator}`);
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));

// license tiers summary
const tiers = {};
for (const r of manifest) (tiers[r.license.name] ||= []).push(r.style);
console.log(`\nGenerated ${manifest.length} styles × ${count} = ${manifest.length * count} SVGs`);
for (const [lic, arr] of Object.entries(tiers)) console.log(`  ${lic}: ${arr.length} styles`);
