#!/usr/bin/env node
// GATE-NEGATIVO: sul codice di prima (i <RigidBody> di rapier dentro PhysicsStage, sonda già
// montata) -> «basso» e «ridotto» rossi, ognuno con «la tela è caduta sul poster» e «3 errori, il
// primo: react-three-rapier: useRapier must be used within <Physics />!», «alto» e «medio» verdi,
// exit 1; con PhysicsBody 4/4 verdi, exit 0, e a fisica spenta il corpo resta a 3.20 (22 ott 2026).
// Secondo negativo, lo stesso giorno: col terreno senza collider (mesh nascosto, niente
// includeInvisible) «alto» e «medio» rossi con «il corpo è passato sotto il terreno (quota
// -8.12, terreno 0)»; col collider il corpo si ferma a 0.27, 4/4 verdi. E col palco in `paused`
// (rapier montato ma fermo) «alto» e «medio» rossi con «il corpo non cade (quota 3.200)».
// Terzo: con PostFX che a 'off' registrava comunque il suo useFrame a priority 1 (spegne
// l'auto-render di R3F) senza disegnare, «basso» rosso con «la tela non viene disegnata: 0.00
// render per fotogramma a regime» mentre gli altri ne facevano 20 e 8; con PostFX che a 'off'
// non monta niente, 2.0 e 4/4 verdi. Prima di questa misura il gate era verde su una tela vuota.
// Quarto: con @react-three/rapier importato staticamente da PhysicsStage (motore e wrapper nel
// chunk del laboratorio, RealismLab-*.js da 2212 KB) «basso» e «ridotto» rossi con «fisica
// spenta ma rapier è stato scaricato: RealismLab-DpWPu4mF.js (motore + wrapper, 2212 KB, 821 KB
// gzip)», exit 1; con l'import dinamico in PhysicsStage 4/4 verdi, rapier scaricato (819 KB gzip)
// solo da «alto» e «medio». E il controllo positivo: con un riconoscimento delle richieste rotto
// apposta, «basso» e «ridotto» tornavano verdi sul codice di prima (il motore si scaricava lo
// stesso) e solo «alto» e «medio» cadevano, con «fisica accesa ma nessuna richiesta del motore».
// Quinto, i collider espliciti di PhysicsCollider (il terreno da solo nel mondo, una palla
// attaccata al primo corpo): con PhysicsCollider che a fisica accesa non rendeva il collider di
// nessuna forma, «alto» e «medio» rossi con «il corpo non cade (quota 3.200)», perché un corpo
// senza collider non ha massa e rapier non lo muove; sabotata la sola forma del terreno, rossi
// con «il corpo è passato sotto il terreno (quota -17.81, terreno 0)». Col codice vero il corpo si
// ferma a 0.28, il raggio della palla sopra la faccia del cilindro, e 4/4 verdi.
// lab-gate.mjs: il laboratorio di realismo (?lab=1) visitato SULLA BUILD, un caso per ramo.
//
// PERCHÉ ESISTE. Il 22 ott 2026 ?lab=1 cadeva sul poster («react-three-rapier: useRapier must be
// used within <Physics />!») a taglia telefono e con prefers-reduced-motion, in dev come in build,
// e nessun gate se ne accorgeva perché nessuno visitava ?lab. Erano i due soli casi in cui la
// fisica si spegne (tier low, o reduced-motion col tier alto): i rami che una visita a 1440 px
// non apre mai. Quindi il gate visita OGNI ramo, e controlla di averlo aperto davvero.
//
// Per ogni caso asserisce, sulla sonda del laboratorio (window.__lab, armata da ?qa=1):
//   - la scena arriva a FRAMES fotogrammi: la sonda sta nella Suspense della scena, quindi conta
//     solo quando HDRI, fisica e post sono montati. Si aspettano fotogrammi, non un timeout;
//   - ogni fotogramma a regime è anche DISEGNATO (almeno un render): un useFrame gira pure su
//     una tela che nessuno presenta, e headless lo scatto WebGPU è nero comunque;
//   - nessun errore in console né eccezione di pagina, e nessun poster DENTRO la tela (quello di
//     App è il fallback di caricamento del chunk e c'è sempre per un attimo: non è il crollo);
//   - tier e fisica sono quelli del caso: un caso che non apre il suo ramo non prova niente;
//   - con la fisica il primo corpo cade e resta sopra il terreno, senza resta alla quota del
//     markup (le due promesse di PhysicsStage, più il collider del terreno);
//   - senza fisica nessuna richiesta dei file di rapier, con la fisica il motore si scarica: la
//     regola del tier («rapier & friends only from medium up») deve risparmiare il DOWNLOAD
//     (2,2 MB, 0,8 MB gzip), non solo l'avvio del WASM. I file si riconoscono dal contenuto, non
//     dal nome: `rapier-*.js` era una facciata di 1 KB, il motore stava nel chunk del laboratorio.
//
// La build la serve il gate stesso, con l'API di `vite preview` su una porta scelta dal sistema:
// non può misurare il server di un'altra sessione (la 5199 dei gate è condivisa fra i worktree).
//
// Uso: node scripts/lab-gate.mjs [--headed]   (dopo `npm run build`)
// Esce 1 se un caso fallisce, se dist/ manca o se il server non parte.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { chromium } from 'playwright-core'
import { preview } from 'vite'

const headed = process.argv.includes('--headed')
// 90 fotogrammi: a 60 Hz il corpo è caduto, ha toccato terra e rimbalzato (un guasto all'urto
// cadrebbe dentro la finestra); il timeout è solo la rete di sicurezza di una scena che non sale.
const FRAMES = 90
const TIMEOUT_MS = 60_000
// spostamenti più piccoli di così non sono una caduta (con la fisica) e non sono una deriva (senza)
const DROP_MIN = 0.05
const STILL_TOL = 1e-4

const exe =
  process.env.CHROMIUM_PATH ??
  `${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`

// Le soglie del tier stanno in src/hooks/useQualityTier.ts (computeTier): telefono = touch sotto
// i 480 px, tablet = touch, desktop largo = high.
const CASES = [
  { name: 'alto', ctx: { viewport: { width: 1440, height: 900 } }, tier: 'high', physics: true },
  {
    name: 'medio',
    ctx: { viewport: { width: 834, height: 1194 }, isMobile: true, hasTouch: true },
    tier: 'medium',
    physics: true,
  },
  {
    name: 'basso',
    ctx: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    tier: 'low',
    physics: false,
  },
  {
    name: 'ridotto',
    ctx: { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' },
    tier: 'high',
    physics: false,
  },
]

if (!existsSync('dist/index.html')) {
  console.error('✗ dist/ assente: esegui prima `npm run build`.')
  process.exit(1)
}

// I file di rapier nella build, riconosciuti da quello che contengono: il motore è il WASM in
// base64 (la firma «\0asm» più la versione 1), il wrapper è @react-three/rapier (il suo messaggio
// d'errore). Il nome non basta: il bundler li mette dove li porta il grafo degli import.
const RAPIER_MARKS = { motore: 'AGFzbQEAAAA', wrapper: 'useRapier must be used within' }
const rapierFiles = new Map() // nome del file → { what, raw, gz }
for (const f of readdirSync('dist/assets')) {
  if (!f.endsWith('.js')) continue
  const buf = readFileSync(join('dist/assets', f))
  const text = buf.toString('latin1')
  const what = Object.keys(RAPIER_MARKS).filter((k) => text.includes(RAPIER_MARKS[k]))
  if (what.length) rapierFiles.set(f, { what, raw: buf.length, gz: gzipSync(buf).length })
}
const hasEngine = (f) => rapierFiles.get(f)?.what.includes('motore')
if (![...rapierFiles.keys()].some(hasEngine)) {
  // senza il motore in mano il controllo dei download sarebbe verde per costruzione
  console.error('✗ nessun file di dist/assets contiene il motore rapier: il gate non saprebbe quale richiesta vietare.')
  process.exit(1)
}
const kb = (n) => (n / 1024).toFixed(0)
const describe = (f) => `${f} (${rapierFiles.get(f).what.join(' + ')}, ${kb(rapierFiles.get(f).raw)} KB, ${kb(rapierFiles.get(f).gz)} KB gzip)`
console.log(`rapier nella build: ${[...rapierFiles.keys()].map(describe).join(' · ')}`)

const server = await preview({
  logLevel: 'silent',
  preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false },
})
const base = server.resolvedUrls?.local?.[0]
if (!base) {
  console.error('✗ vite preview non ha restituito un indirizzo')
  await server.close()
  process.exit(1)
}

const browser = await chromium.launch({
  executablePath: exe,
  headless: !headed,
  args: ['--enable-unsafe-webgpu', '--use-angle=metal'],
})

const results = []
try {
  for (const c of CASES) {
    const context = await browser.newContext(c.ctx)
    const page = await context.newPage()
    const errors = []
    let backend = null
    page.on('console', (m) => {
      const text = m.text()
      if (text.includes('renderer backend')) backend = text.split(':').pop().trim()
      if (m.type() === 'error') errors.push(text)
    })
    page.on('pageerror', (e) => errors.push(e.message))
    // ogni contesto parte con la cache vuota: una richiesta vista qui è un download vero
    const rapierFetched = new Set()
    page.on('request', (r) => {
      const file = new URL(r.url()).pathname.split('/').pop()
      if (rapierFiles.has(file)) rapierFetched.add(file)
    })

    await page.goto(`${base}?lab=1&qa=1`, { waitUntil: 'load', timeout: TIMEOUT_MS })
    // fotogrammi o crollo, quello che arriva prima: un crollo non aspetta il timeout
    let timedOut = false
    await page
      .waitForFunction(
        (n) => (window.__lab?.frames ?? 0) >= n || !!document.querySelector('.canvas-layer .poster'),
        FRAMES,
        { timeout: TIMEOUT_MS, polling: 100 },
      )
      .catch(() => {
        timedOut = true
      })
    const seen = await page.evaluate(() => ({
      lab: window.__lab ?? null,
      crashed: !!document.querySelector('.canvas-layer .poster'),
    }))
    await context.close()

    const why = []
    if (seen.crashed) why.push('la tela è caduta sul poster')
    if (errors.length) why.push(`${errors.length} errori, il primo: ${errors[0].split('\n')[0].slice(0, 160)}`)
    const lab = seen.lab
    if (!lab) {
      if (!seen.crashed) why.push(timedOut ? `nessuna sonda dopo ${TIMEOUT_MS / 1000} s` : 'nessuna sonda')
    } else {
      if (lab.frames < FRAMES) why.push(`${lab.frames} fotogrammi su ${FRAMES}`)
      // un fotogramma che passa non è un fotogramma disegnato: almeno un render ciascuno, a regime
      if (!(lab.rendersPerFrame >= 1))
        why.push(`la tela non viene disegnata: ${Number.isFinite(lab.rendersPerFrame) ? lab.rendersPerFrame.toFixed(2) : 'n/d'} render per fotogramma a regime`)
      if (lab.tier !== c.tier) why.push(`tier ${lab.tier}, il caso voleva ${c.tier}: il ramo non è stato aperto`)
      if (lab.physics !== c.physics)
        why.push(`fisica ${lab.physics ? 'accesa' : 'spenta'}, il caso la voleva ${c.physics ? 'accesa' : 'spenta'}`)
      const drop = lab.startY - lab.y
      if (!Number.isFinite(drop)) why.push('quota del corpo non leggibile')
      else if (lab.physics && drop < DROP_MIN)
        why.push(`fisica accesa ma il corpo non cade (quota ${lab.y.toFixed(3)}, partenza ${lab.startY})`)
      else if (lab.physics && !(lab.y > lab.floorY))
        why.push(`fisica accesa ma il corpo è passato sotto il terreno (quota ${lab.y.toFixed(2)}, terreno ${lab.floorY}): nessun collider l'ha fermato`)
      else if (!lab.physics && Math.abs(drop) > STILL_TOL)
        why.push(`fisica spenta ma il corpo si è mosso di ${drop.toFixed(4)}`)
    }
    // il download di rapier segue la fisica del CASO: spenta = nessun suo file, accesa = il motore
    // arriva. Il secondo è il controllo positivo: senza, un gate che non riconosce più il chunk
    // (nome, firma, percorso) direbbe «niente rapier» anche dove si scarica.
    const fetched = [...rapierFetched]
    if (!c.physics && fetched.length)
      why.push(`fisica spenta ma rapier è stato scaricato: ${fetched.map(describe).join(', ')}`)
    if (c.physics && !fetched.some(hasEngine))
      why.push(`fisica accesa ma nessuna richiesta del motore rapier (${[...rapierFiles.keys()].filter(hasEngine).join(', ')}): il gate non vede il file che vieta negli altri casi`)
    results.push({ c, lab, backend, why })

    const size = `${c.ctx.viewport.width}×${c.ctx.viewport.height}${c.ctx.reducedMotion ? ' reduced' : ''}`
    const rapierGz = fetched.reduce((s, f) => s + rapierFiles.get(f).gz, 0)
    const download = fetched.length ? `rapier scaricato (${kb(rapierGz)} KB gzip)` : 'rapier non scaricato'
    const facts = lab
      ? `tier ${lab.tier} · fisica ${lab.physics ? 'accesa' : 'spenta'} · ${backend ?? 'backend?'} · ${lab.frames} fotogrammi · ${Number.isFinite(lab.rendersPerFrame) ? lab.rendersPerFrame.toFixed(1) : 'n/d'} render/fotogramma · corpo ${lab.startY.toFixed(2)} → ${Number.isFinite(lab.y) ? lab.y.toFixed(2) : 'n/d'} · ${download}`
      : `${backend ?? 'backend?'} · nessuna sonda · ${download}`
    console.log(`${why.length ? '✗' : '✓'} ${c.name.padEnd(8)} ${size.padEnd(17)} ${facts}`)
    for (const w of why) console.log(`    ${w}`)
  }
} finally {
  await browser.close()
  await server.close()
}

const red = results.filter((r) => r.why.length)
console.log(`\n?lab=1 sulla build: ${results.length - red.length}/${results.length} casi verdi`)
if (red.length) {
  console.log(`rossi: ${red.map((r) => r.c.name).join(', ')}`)
  process.exitCode = 1
}
