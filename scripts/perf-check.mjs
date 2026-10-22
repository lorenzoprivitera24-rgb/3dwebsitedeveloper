#!/usr/bin/env node
// perf-check.mjs — il gate S7: budget come numeri, non come consigli.
// GATE-NEGATIVO: il righello vecchio (somma di tutti i .js) non si muoveva sul code-split,
// che è proprio il fix che il gate chiedeva: totale identito al byte, semaforo fermo su 🟡
// per mesi. Quello nuovo legge l'ingresso + i modulepreload da dist/index.html e separa
// iniziale 157,5 KB · differito 429,7 · totale 587,2: 🟡→🟢 senza che il totale cambi (6 ago 2026).
// Secondo negativo, la guardia sul motore rapier (22 ott 2026): con `import { CuboidCollider }
// from '@react-three/rapier'` usato per valore in registry/04-pointer-rig-3d/RigSatellite.tsx
// (statico da CanvasLayer) 🔴 ed exit 1, unico FAIL: «motore rapier nel grafo statico di
// src/canvas/CanvasLayer.tsx: CanvasLayer-D5hkV5PS.js → react-three-rapier.esm-CMLDGo9v.js
// (818.8 KB gzip a ogni tier)». Rolldown ne fa un chunk comune: nessun dynamic entry di rapier,
// la facciata sparisce. Tolto l'import, nessun FAIL (🟡 per i due warn di sempre) ed esenti solo
// il wrapper e la facciata. Sulla PhysicsStage di prima (import statico, motore DENTRO
// RealismLab-DpWPu4mF.js) «motore rapier nel grafo statico di src/lab/RealismLab.tsx». Ed è il
// perché dell'esenzione decisa dal modulo d'ingresso: decisa dal contenuto del chunk, su quella
// build RealismLab risultava «chunk di rapier stesso, esente» e il FAIL cadeva sulla facciata,
// cioè sul colpevole sbagliato. Rifatto lo stesso giorno con PhysicsCollider nel kit: stesso
// unico FAIL ed exit 1, col messaggio che ora indica «passa da PhysicsStage (PhysicsBody,
// PhysicsCollider)». E la controprova nello stesso file, `<PhysicsCollider shape="cuboid"
// args={[0.3, 0.3, 0.3]} />` al posto del collider di rapier: nessun FAIL, CanvasLayer fra i
// chunk senza motore. La strada lecita non rimette il motore nel grafo statico.
// Misura la build (dist/) e gli asset (public/) e scrive qa/perf-report.md.
// Exit: 0 verde (anche con warn) · 1 rosso (hard cap sforato, o motore rapier fuori posto).
// Richiede `npm run build` prima.
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
//   Motore rapier FAIL se sta nel grafo statico di un entry o di un chunk lazy che non è rapier
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

// --- il motore rapier solo dietro un import() di rapier stesso (22 ott 2026) ---
// Il motore (@dimforge/rapier3d-compat, il WASM in base64: 2,2 MB, 0,8 MB gzip) si scarica solo
// a fisica accesa perché PhysicsStage chiede @react-three/rapier con import(). Un import di
// VALORE da @react-three/rapier in un altro file (un collider in un blueprint montato da
// CanvasLayer) lo rimette nel grafo statico di quel chunk, e lo scarica chiunque, a ogni tier.
// I numeri qui sopra non lo vedono: il JS iniziale non cambia (CanvasLayer è già dietro il
// confine dinamico) e il totale è oltre il warn proprio per il chunk di rapier; qa:lab visita
// solo ?lab=1. Regola: il file col motore non sta nella chiusura `imports` (solo statici, come
// per il JS iniziale) di nessun entry, né di nessun dynamic entry che non sia rapier stesso.
//
// Il motore si riconosce dal CONTENUTO, mai dal nome: è il .js con la firma del WASM in base64
// («\0asm» più la versione 1). Il bundler mette i moduli dove li porta il grafo: `rapier-*.js` è
// una facciata di 1 KB che importa staticamente il chunk vero, e fino al 22 ott il motore stava
// in RealismLab-*.js. Anche «rapier stesso» si decide dal contenuto, ma del MODULO d'ingresso del
// dynamic entry (`src` nel manifest), non del suo chunk: un chunk che ha inghiottito il motore
// contiene la firma, e CanvasLayer risulterebbe esente proprio quando sbaglia. Il modulo del chunk
// vero è il wrapper (porta il suo messaggio d'errore), quello della facciata è il motore stesso.
// Solo moduli di terze parti: un file del progetto può citare la firma in un commento (lo fa
// PhysicsStage), e un import() del progetto non diventa rapier per questo.
const ENGINE_MARK = 'AGFzbQEAAAA'
const RAPIER_MARKS = [ENGINE_MARK, 'useRapier must be used within']
const engineGz = new Map() // file col motore, come lo scrive il manifest → peso gzip
for (const f of readdirSync('dist/assets')) {
  if (!f.endsWith('.js')) continue
  const buf = readFileSync(join('dist/assets', f))
  if (buf.toString('latin1').includes(ENGINE_MARK)) engineGz.set(`assets/${f}`, gzipSync(buf).length)
}
const isRapierModule = (src) => {
  if (!src?.split(/[\\/]/).includes('node_modules')) return false
  try {
    const text = readFileSync(src, 'latin1') // `src` è relativo alla root di Vite, cioè a qui
    return RAPIER_MARKS.some((m) => text.includes(m))
  } catch {
    return false // illeggibile = non esente: il dubbio non apre la guardia
  }
}
const label = (c) => (c.src ?? c.file).replace(/^.*node_modules[\\/]/, '')
const base = (file) => file.replace(/^.*\//, '')
// la catena di file dal chunk al primo file col motore, seguendo SOLO `imports`; null se non c'è
function chainToEngine(from) {
  const parent = new Map([[from.file, null]])
  const queue = [from]
  while (queue.length) {
    const chunk = queue.shift()
    if (engineGz.has(chunk.file)) {
      const chain = []
      for (let f = chunk.file; f; f = parent.get(f)) chain.unshift(f)
      return chain
    }
    for (const key of chunk.imports ?? []) {
      const dep = manifest[key]
      if (dep && !parent.has(dep.file)) {
        parent.set(dep.file, chunk.file)
        queue.push(dep)
      }
    }
  }
  return null
}
const rapierLines = []
if (!engineGz.size) {
  // senza il motore in mano la guardia sarebbe verde per costruzione
  fails.push(
    `motore rapier non trovato: nessun .js di dist/assets contiene la firma del WASM (${ENGINE_MARK}), la guardia non saprebbe quale file vietare`,
  )
} else {
  let reached = false
  const own = []
  const clean = []
  for (const chunk of Object.values(manifest)) {
    if (!chunk.isEntry && !chunk.isDynamicEntry) continue
    const chain = chainToEngine(chunk)
    if (chain) reached = true
    if (!chunk.isEntry && isRapierModule(chunk.src)) own.push(label(chunk))
    else if (!chain) clean.push(label(chunk))
    else
      fails.push(
        `motore rapier nel grafo statico di ${label(chunk)}: ${chain.map(base).join(' → ')} (${kb(engineGz.get(chain.at(-1)))} KB gzip a ogni tier). Un import di VALORE da @react-three/rapier: passa da PhysicsStage (PhysicsBody, PhysicsCollider), o importa solo tipi`,
      )
  }
  // controllo positivo: se nessuna chiusura arriva al motore, il cammino non vede questa build
  // (manifest di un'altra build, o un chunk raggiunto solo da import() senza dynamic entry)
  if (!reached)
    fails.push(
      `motore rapier fuori dal cammino della guardia: nessun entry né dynamic entry arriva a ${[...engineGz.keys()].map(base).join(', ')} con i soli import statici, quindi non saprebbe dire chi lo scarica`,
    )
  rapierLines.push(
    `- motore: ${[...engineGz].map(([f, gz]) => `${base(f)} (${kb(gz)} KB gzip)`).join(', ')}, riconosciuto dalla firma del WASM`,
    `- chunk di rapier stesso, esenti: ${own.join(', ') || 'nessuno'}`,
    `- senza motore nel grafo statico: ${clean.join(', ') || 'nessuno'}`,
  )
}

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

## Motore rapier, solo dietro un import() di rapier stesso
${rapierLines.join('\n') || '- non trovato (vedi FAIL)'}

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
// tutto fino alla tabella dei file: ogni FAIL e ogni warn, non solo il primo
console.log(md.split('\n## File della build')[0])
console.log(`→ qa/perf-report.md`)
if (fails.length) process.exit(1)
