#!/usr/bin/env node
// perf-check.mjs — il gate S7: budget come numeri, non come consigli.
// Misura la build (dist/) e gli asset (public/) e scrive qa/perf-report.md.
// Exit: 0 verde (anche con warn) · 1 rosso (hard cap sforato). Richiede `npm run build` prima.
//
// COSA CONTA COME «JS INIZIALE» (corretto ago 2026). Prima questo script sommava *tutti* i .js
// di dist/assets e chiamava il totale «JS iniziale». Sbagliato in un modo che contava: dopo un
// code-split il totale resta identico mentre l'iniziale crolla, quindi il gate non avrebbe mai
// visto il miglioramento — né una regressione che sposta peso sul percorso critico. Ora legge
// il manifest di Vite, parte dagli entry e cammina SOLO gli import statici: quello è ciò che il
// browser deve scaricare prima del primo frame. Il resto è «su richiesta».
//
// I due numeri servono entrambi. Misurare solo l'iniziale si aggira mettendo tutto dietro un
// import dinamico: il sito resta pesante, il gate resta verde. Quindi l'iniziale ha il budget
// stretto e il totale fa da guardia.
//
// Budget:
//   JS iniziale  target 150 KB gzip (WARN sopra) · hard cap 300 KB gzip (FAIL)
//   JS totale    warn > 700 KB gzip (guardia: peso spostato su lazy, non eliminato)
//   CSS          warn > 60 KB gzip
//   GLB totali   FAIL > 5 MB
//   HDRI         warn > 2 MB l'uno (1k basta per la sola IBL)
//   Font woff2   warn > 100 KB l'uno (subsetting!)
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, extname } from 'node:path'
import { gzipSync } from 'node:zlib'

const kb = (n) => Math.round(n / 102.4) / 10
const warns = []
const fails = []

if (!existsSync('dist/assets')) {
  console.error('✗ dist/ assente: esegui prima `npm run build`.')
  process.exit(1)
}

// --- il grafo statico degli entry, dal manifest di Vite ---
const MANIFEST = 'dist/.vite/manifest.json'
if (!existsSync(MANIFEST)) {
  console.error(`✗ ${MANIFEST} assente: serve \`build.manifest: true\` in vite.config.ts.`)
  process.exit(1)
}
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))

// BFS dagli entry seguendo SOLO `imports` (statici). `dynamicImports` è di proposito escluso:
// è esattamente il confine che separa il percorso critico dal resto.
const initialFiles = new Set()
const queue = Object.values(manifest).filter((c) => c.isEntry)
const seen = new Set(queue.map((c) => c.file))
while (queue.length) {
  const chunk = queue.shift()
  initialFiles.add(chunk.file)
  for (const css of chunk.css ?? []) initialFiles.add(css)
  for (const key of chunk.imports ?? []) {
    const dep = manifest[key]
    if (dep && !seen.has(dep.file)) {
      seen.add(dep.file)
      queue.push(dep)
    }
  }
}

// --- pesi reali (gzip) di ogni file emesso, marcati iniziale/lazy ---
let initialJsGz = 0
let lazyJsGz = 0
let cssGz = 0
const rows = []
for (const f of readdirSync('dist/assets')) {
  const ext = extname(f)
  if (ext !== '.js' && ext !== '.css') continue
  const p = join('dist/assets', f)
  const gz = gzipSync(readFileSync(p)).length
  const isInitial = initialFiles.has(`assets/${f}`)
  if (ext === '.js') {
    if (isInitial) initialJsGz += gz
    else lazyJsGz += gz
  } else {
    cssGz += gz
  }
  rows.push(
    `| ${f} | ${isInitial ? '**iniziale**' : 'su richiesta'} | ${kb(statSync(p).size)} KB | ${kb(gz)} KB gzip |`,
  )
}
rows.sort((a, b) => (a.includes('iniziale') ? -1 : 1) - (b.includes('iniziale') ? -1 : 1))

if (initialJsGz > 300 * 1024) fails.push(`JS iniziale ${kb(initialJsGz)} KB gzip > hard cap 300 KB`)
else if (initialJsGz > 150 * 1024)
  warns.push(`JS iniziale ${kb(initialJsGz)} KB gzip > target 150 KB`)
if (initialJsGz + lazyJsGz > 700 * 1024)
  warns.push(
    `JS totale ${kb(initialJsGz + lazyJsGz)} KB gzip > 700 KB (il peso è rimandato, non tolto)`,
  )
if (cssGz > 60 * 1024) warns.push(`CSS ${kb(cssGz)} KB gzip > 60 KB`)

// --- asset ricorsivi (public/) ---
function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}
let glbTotal = 0
for (const p of walk('public')) {
  const size = statSync(p).size
  const ext = extname(p).toLowerCase()
  if (ext === '.glb' || ext === '.gltf') glbTotal += size
  if ((ext === '.hdr' || ext === '.exr') && size > 2 * 1024 * 1024)
    warns.push(`HDRI ${p} ${kb(size)} KB > 2 MB (1k basta per la sola IBL)`)
  if (ext === '.woff2' && size > 100 * 1024) warns.push(`font ${p} ${kb(size)} KB > 100 KB → subsetting`)
}
if (glbTotal > 5 * 1024 * 1024) fails.push(`GLB totali ${kb(glbTotal)} KB > 5 MB`)

// --- report ---
const status = fails.length ? '🔴 ROSSO — deploy bloccato' : warns.length ? '🟡 VERDE con warn' : '🟢 VERDE'
const md = `# Perf report — gate S7

Stato: **${status}** · Data: (git log della build)

## Totali
- **JS iniziale: ${kb(initialJsGz)} KB gzip** (target 150 · cap 300) — entry + import statici, ciò
  che il browser scarica prima del primo frame
- JS su richiesta: ${kb(lazyJsGz)} KB gzip (canvas/three dietro il confine dinamico)
- JS totale: ${kb(initialJsGz + lazyJsGz)} KB gzip (warn > 700)
- CSS: ${kb(cssGz)} KB gzip · GLB: ${kb(glbTotal)} KB (cap 5120)

## FAIL
${fails.map((f) => '- ' + f).join('\n') || '- nessuno'}

## Warn
${warns.map((w) => '- ' + w).join('\n') || '- nessuno'}

## File della build
| file | percorso | raw | gzip |
|---|---|---|---|
${rows.join('\n')}

Nota: LCP/CWV reali si misurano sul deploy (Lighthouse), non qui; questo gate copre pesi e
regressioni. Il fallback WebGPU→WebGL2 e reduced-motion li verifica il perf-fallback-auditor
con qa:verify/qa:shoot.
`
mkdirSync('qa', { recursive: true })
writeFileSync('qa/perf-report.md', md)
console.log(md.split('\n').slice(0, 14).join('\n'))
console.log(`→ qa/perf-report.md`)
if (fails.length) process.exit(1)
