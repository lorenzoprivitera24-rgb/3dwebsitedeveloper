#!/usr/bin/env node
// perf-check.mjs — il gate S7: budget come numeri, non come consigli.
// Misura la build (dist/) e gli asset (public/) e scrive qa/perf-report.md.
// Exit: 0 verde (anche con warn) · 1 rosso (hard cap sforato). Richiede `npm run build` prima.
//
// Budget (fonte: playbook/deep-dive in docs/ + CLAUDE.md):
//   JS iniziale  target 300 KB gzip (WARN sopra) · hard cap 800 KB gzip (FAIL — guardia regressioni)
//   CSS          warn > 60 KB gzip
//   GLB totali   FAIL > 5 MB
//   HDRI         warn > 2 MB l'uno (1k basta per la sola IBL)
//   Font woff2   warn > 100 KB l'uno (subsetting!)
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, extname } from 'node:path'
import { gzipSync } from 'node:zlib'

const kb = (n) => Math.round(n / 102.4) / 10
const rows = []
const warns = []
const fails = []

if (!existsSync('dist/assets')) {
  console.error('✗ dist/ assente: esegui prima `npm run build`.')
  process.exit(1)
}

// --- JS/CSS della build (gzip reale) ---
let jsGz = 0, cssGz = 0
for (const f of readdirSync('dist/assets')) {
  const p = join('dist/assets', f)
  const ext = extname(f)
  if (ext === '.js' || ext === '.css') {
    const gz = gzipSync(readFileSync(p)).length
    rows.push(`| ${f} | ${kb(statSync(p).size)} KB | ${kb(gz)} KB gzip |`)
    if (ext === '.js') jsGz += gz
    else cssGz += gz
  }
}
if (jsGz > 800 * 1024) fails.push(`JS iniziale ${kb(jsGz)} KB gzip > hard cap 800 KB`)
else if (jsGz > 300 * 1024) warns.push(`JS iniziale ${kb(jsGz)} KB gzip > target 300 KB (debito noto: code-split/starter Next — gap analysis)`)
if (cssGz > 60 * 1024) warns.push(`CSS ${kb(cssGz)} KB gzip > 60 KB`)

// --- asset ricorsivi (public/ + dist/) ---
function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}
const assets = walk('public')
let glbTotal = 0
for (const p of assets) {
  const size = statSync(p).size
  const ext = extname(p).toLowerCase()
  if (ext === '.glb' || ext === '.gltf') glbTotal += size
  if ((ext === '.hdr' || ext === '.exr') && size > 2 * 1024 * 1024) warns.push(`HDRI ${p} ${kb(size)} KB > 2 MB (1k basta per la sola IBL)`)
  if (ext === '.woff2' && size > 100 * 1024) warns.push(`font ${p} ${kb(size)} KB > 100 KB → subsetting`)
}
if (glbTotal > 5 * 1024 * 1024) fails.push(`GLB totali ${kb(glbTotal)} KB > 5 MB`)

// --- report ---
const status = fails.length ? '🔴 ROSSO — deploy bloccato' : warns.length ? '🟡 VERDE con warn' : '🟢 VERDE'
const md = `# Perf report — gate S7

Stato: **${status}** · Data: (git log della build)

## Totali
- JS iniziale: **${kb(jsGz)} KB gzip** (target 300 · cap 800)
- CSS: ${kb(cssGz)} KB gzip · GLB: ${kb(glbTotal)} KB (cap 5120)

## FAIL
${fails.map((f) => '- ' + f).join('\n') || '- nessuno'}

## Warn
${warns.map((w) => '- ' + w).join('\n') || '- nessuno'}

## File della build
| file | raw | gzip |
|---|---|---|
${rows.join('\n')}

Nota: LCP/CWV reali si misurano sul deploy (Lighthouse), non qui; questo gate copre pesi e
regressioni. Il fallback WebGPU→WebGL2 e reduced-motion li verifica il perf-fallback-auditor
con qa:verify/qa:shoot.
`
mkdirSync('qa', { recursive: true })
writeFileSync('qa/perf-report.md', md)
console.log(md.split('\n').slice(0, 12).join('\n'))
console.log(`→ qa/perf-report.md`)
if (fails.length) process.exit(1)
