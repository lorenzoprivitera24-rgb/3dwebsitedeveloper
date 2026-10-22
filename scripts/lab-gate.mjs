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
// Quinto, i casi WebKit (stesso giorno): con la rivelazione di Stage che lasciava la tela a
// opacity 0 (i render continuano, a schermo niente) «iphone» e «safari» rossi con «il ritaglio
// con la tela pesa 1.00 volte quello senza», e solo con quello; dopo, ×59 e ×116. La prima
// versione usava la soglia assoluta di shoot.mjs (0,02 B/px) e sullo stesso sabotaggio «iphone»
// passava (0,026). Sesto: senza navigator.gpu i quattro casi Chromium rossi con «motore grafico
// WebGL2, il caso voleva WebGPU» (`--disable-features=WebGPU` invece non lo spegne: resta WebGPU).
// Settimo, i collider espliciti di PhysicsCollider (il terreno da solo nel mondo, una palla
// attaccata al primo corpo): con PhysicsCollider che a fisica accesa non rendeva il collider di
// nessuna forma, «alto» e «medio» rossi con «il corpo non cade (quota 3.200)», perché un corpo
// senza collider non ha massa e rapier non lo muove; sabotata la sola forma del terreno, rossi
// con «il corpo è passato sotto il terreno (quota -17.81, terreno 0)». Col codice vero il corpo si
// ferma a 0.28, il raggio della palla sopra la faccia del cilindro, e 4/4 verdi.
// Ottavo, i giunti e il resto di rapier dal palco (il Lanyard del kit, PhysicsMeshCollider,
// PhysicsInstancedBodies, PhysicsStep, interactionGroups), stesso giorno. La prima sonda della
// catena filtrava i giunti su joint.type(), che in rapier3d-compat 0.19 dà Generic a tutti: non ne
// misurava nessuno e l'apertura «0.000» era verde per assenza; l'ha preso il controllo nuovo
// «la sonda ha misurato 0 giunti su 4», e ora i limiti vengono da declaredJoint. Poi, ognuno
// sul suo assert: PhysicsJoint che a fisica accesa non rende niente -> «alto» e «medio» rossi con
// «nel mondo ci sono 0 giunti, il markup del Lanyard ne dichiara 4» e basta (la card cade libera,
// 2.90); PhysicsJoint che passa a rapier corde lunghe il triplo e l'ancora della card doppia ->
// «una corda è andata oltre la sua lunghezza del 200.7%» e «l'aggancio sferico della card si è
// aperto di 0.725»; PhysicsMeshCollider che a fisica accesa rende i figli senza collider -> «il
// corpo «secondo» non cade (quota 4.400)»; PhysicsStep che non registra niente -> «PhysicsStep
// non ha visto nessun passo del mondo» e basta; le istanze ferme senza le matrici scritte ->
// «basso» e «ridotto» rossi con «l'istanza 0 di PhysicsInstancedBodies non è nella posa del markup
// (quota 0.0000, nel markup 2.6)», una riga per istanza; interactionGroups con << 15 al posto di
// << 16 -> «diverge da rapier in 1295 combinazioni su 1332, la prima (0, undefined): palco 98303,
// rapier 131071», exit 1. Col codice vero 4/4 verdi: corde al massimo +11.8%, aggancio 0.0002.
// Su WebKit il Lanyard di prima (coi pixel vuoti di React Bits per le facce che mancano) dava
// «WebGL: INVALID_VALUE: texSubImage2D: bad image data» in console: rosso «safari» per errori.
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
//   - con la fisica i corpi (uno col collider esplicito, uno con PhysicsMeshCollider) e le istanze
//     di PhysicsInstancedBodies cadono e restano sopra il terreno, senza restano nella posa del
//     markup (le due promesse di PhysicsStage, più il collider del terreno);
//   - con la fisica la catena del Lanyard (PhysicsJoint) ha nel mondo i giunti che il markup
//     dichiara, si muove e resta legata: nessuna corda oltre la sua lunghezza, l'aggancio della
//     card chiuso, misurati a ogni passo da PhysicsStep sulle ancore dichiarate; senza, nessun
//     passo, nessun giunto, la card ferma;
//   - senza fisica nessuna richiesta dei file di rapier, con la fisica il motore si scarica: la
//     regola del tier («rapier & friends only from medium up») deve risparmiare il DOWNLOAD
//     (2,2 MB, 0,8 MB gzip), non solo l'avvio del WASM. I file si riconoscono dal contenuto, non
//     dal nome: `rapier-*.js` era una facciata di 1 KB, il motore stava nel chunk del laboratorio.
//
// I motori. Chromium (WebGPU) in `verify`: quattro casi, uno per ramo di tier e reduced-motion.
// WebKit in `verify:full` (`qa:lab:webkit`): il ripiego WebGL2 degli iPhone fino a iOS 18, dove
// gira la compilazione in parallelo, a taglia iPhone 15 (tier low) e a 1440 (tier high). Ogni caso
// vuole anche il SUO motore grafico, e su WebKit la tela deve arrivare allo schermo: lo stesso
// ritaglio scattato con la tela e senza deve pesare almeno CANVAS_GAIN_MIN volte tanto. Su Chromium
// headless lo scatto WebGPU è nero comunque, quindi lì contano solo i render.
//
// Prima del browser, in Node: interactionGroups del palco uguale a quella di rapier su ogni
// combinazione di gruppi (il palco ne tiene una copia, che divergerebbe in silenzio).
//
// La build la serve il gate stesso, con l'API di `vite preview` su una porta scelta dal sistema:
// non può misurare il server di un'altra sessione (la 5199 dei gate è condivisa fra i worktree).
//
// Uso: node scripts/lab-gate.mjs [--motori=chromium,webkit] [--headed]   (dopo `npm run build`;
//      senza --motori solo chromium)
// Esce 1 se un caso fallisce, se interactionGroups diverge, se dist/ manca o se il server non
// parte; 2 con un motore sconosciuto.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { chromium, devices, webkit } from 'playwright-core'
import { preview, transformWithOxc } from 'vite'
import { percorsoBrowser } from './_browser.mjs'

const argv = process.argv.slice(2)
const headed = argv.includes('--headed')
const ENGINES = {
  chromium: { type: chromium, args: ['--enable-unsafe-webgpu', '--use-angle=metal'], backend: 'WebGPU', pixels: false },
  webkit: { type: webkit, args: [], backend: 'WebGL2', pixels: true },
}
const MOTORI = (argv.find((a) => a.startsWith('--motori='))?.slice('--motori='.length) ?? 'chromium')
  .split(',')
  .filter(Boolean)
const unknown = MOTORI.filter((m) => !ENGINES[m])
if (unknown.length || !MOTORI.length) {
  console.error(`✗ --motori: ${unknown.join(', ') || 'vuoto'}; i motori sono ${Object.keys(ENGINES).join(', ')}`)
  process.exit(2)
}
// 90 fotogrammi: a 60 Hz il corpo è caduto, ha toccato terra e rimbalzato (un guasto all'urto
// cadrebbe dentro la finestra); il timeout è solo la rete di sicurezza di una scena che non sale.
const FRAMES = 90
const TIMEOUT_MS = 60_000
// spostamenti più piccoli di così non sono una caduta (con la fisica) e non sono una deriva (senza)
const DROP_MIN = 0.05
const STILL_TOL = 1e-4
// Il ritaglio con la tela diviso lo stesso ritaglio con la tela nascosta, in byte di PNG: una tela
// che non arriva allo schermo dà 1 esatto (le due immagini sono la stessa), la scena decine di
// volte tanto. Una soglia assoluta qui non regge: la 0,02 B/px di shoot.mjs, rifatta sulla tela
// nascosta, dava 0,026 a taglia iPhone (verde) e 0,0198 a 1440, perché il fondo non è piatto.
const CANVAS_GAIN_MIN = 2
// Quanto i giunti del Lanyard possono aprirsi prima che la catena sia «staccata». Il risolutore di
// rapier è morbido: misurato il 22 ott 2026, le corde (0,5) partono lente, al passo ~20 si tendono
// sotto la card che cade e vanno oltre la loro lunghezza dell'11,8%, a riposo del 2,6%; l'aggancio
// sferico resta entro 0,0002. Le soglie stanno a circa il doppio, e un giunto sbagliato le passa
// di molto (vedi l'header).
const ROPE_STRETCH_TOL = 0.25
const HOOK_GAP_TOL = 0.01

// Le soglie del tier stanno in src/hooks/useQualityTier.ts (computeTier): telefono = touch sotto
// i 480 px, tablet = touch, desktop largo = high.
const CASES = [
  { name: 'alto', engine: 'chromium', ctx: { viewport: { width: 1440, height: 900 } }, tier: 'high', physics: true },
  {
    name: 'medio',
    engine: 'chromium',
    ctx: { viewport: { width: 834, height: 1194 }, isMobile: true, hasTouch: true },
    tier: 'medium',
    physics: true,
  },
  {
    name: 'basso',
    engine: 'chromium',
    ctx: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    tier: 'low',
    physics: false,
  },
  {
    name: 'ridotto',
    engine: 'chromium',
    ctx: { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' },
    tier: 'high',
    physics: false,
  },
  // l'iPhone del cliente: WebKit, touch, 393 px, quindi tier low, fisica e post spenti
  { name: 'iphone', engine: 'webkit', ctx: { ...devices['iPhone 15'] }, tier: 'low', physics: false },
  { name: 'safari', engine: 'webkit', ctx: { viewport: { width: 1440, height: 900 } }, tier: 'high', physics: true },
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

// interactionGroups del palco contro quella di rapier, prima del browser. Il palco ne tiene una
// copia (importata da rapier per valore porterebbe il motore nel chunk), e una copia di una
// formula diverge in silenzio. Ogni gruppo da solo, come numero e come array, i due estremi
// insieme, vuoto, tutti; i filtri assenti più gli stessi insiemi. Il .ts lo traduce Vite (Node 20
// non toglie i tipi da solo), e il modulo non ha import, quindi gira da un data: URL.
const groupsTs = 'src/canvas/physics/interactionGroups.ts'
const { code: groupsJs } = await transformWithOxc(readFileSync(groupsTs, 'utf8'), groupsTs)
const { interactionGroups: kitGroups } = await import(`data:text/javascript;base64,${Buffer.from(groupsJs).toString('base64')}`)
const { interactionGroups: rapierGroups } = await import('@react-three/rapier')
const ALL = [...Array(16).keys()]
const SETS = [...ALL, ...ALL.map((g) => [g]), [0, 15], [1, 2, 3], [], ALL]
const groupDiffs = []
for (const m of SETS)
  for (const f of [undefined, ...SETS])
    if (kitGroups(m, f) !== rapierGroups(m, f))
      groupDiffs.push(`(${JSON.stringify(m)}, ${JSON.stringify(f)}): palco ${kitGroups(m, f)}, rapier ${rapierGroups(m, f)}`)
const groupCases = SETS.length * (SETS.length + 1)
if (groupDiffs.length)
  console.log(`✗ interactionGroups del palco diverge da rapier in ${groupDiffs.length} combinazioni su ${groupCases}, la prima ${groupDiffs[0]}`)
else console.log(`✓ interactionGroups del palco = quella di rapier su ${groupCases} combinazioni`)

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

const results = []
try {
  for (const motore of MOTORI) {
    const engine = ENGINES[motore]
    const browser = await engine.type.launch({
      executablePath: percorsoBrowser(motore),
      headless: !headed,
      args: engine.args,
    })
    try {
      for (const c of CASES.filter((k) => k.engine === motore)) results.push(await visit(browser, engine, c))
    } finally {
      await browser.close()
    }
  }
} finally {
  await server.close()
}

const red = results.filter((r) => r.why.length)
console.log(`\n?lab=1 sulla build (${MOTORI.join(', ')}): ${results.length - red.length}/${results.length} casi verdi`)
if (red.length) {
  console.log(`rossi: ${red.map((r) => r.c.name).join(', ')}`)
  process.exitCode = 1
}
if (groupDiffs.length) {
  console.log('rosso anche interactionGroups del palco (vedi sopra)')
  process.exitCode = 1
}

async function visit(browser, engine, c) {
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
  // La tela allo schermo, dove lo scatto la vede (WebKit): lo stesso ritaglio con la tela e con la
  // tela nascosta. Si guarda la metà bassa, terreno ed erba: in alto il cielo è scuro e uniforme
  // anche con la scena su, in basso a sinistra c'è l'etichetta del laboratorio.
  let gain = null
  if (engine.pixels && seen.lab && !seen.crashed) {
    const vp = c.ctx.viewport
    const clip = {
      x: Math.round(vp.width * 0.1),
      y: Math.round(vp.height * 0.5),
      width: Math.round(vp.width * 0.8),
      height: Math.round(vp.height * 0.3),
    }
    const weight = async () => (await page.screenshot({ scale: 'css', clip })).length
    const withCanvas = await weight()
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('.canvas-layer canvas')) el.style.visibility = 'hidden'
    })
    gain = withCanvas / (await weight())
  }
  await context.close()

  const why = []
  if (seen.crashed) why.push('la tela è caduta sul poster')
  if (errors.length) why.push(`${errors.length} errori, il primo: ${errors[0].split('\n')[0].slice(0, 160)}`)
  // il motore grafico è parte del ramo: un caso WebKit finito su WebGPU non prova più il WebGL2
  if (backend !== engine.backend)
    why.push(`motore grafico ${backend ?? 'non dichiarato da Stage'}, il caso voleva ${engine.backend}: il ramo non è stato aperto`)
  const lab = seen.lab
  if (!lab) {
    if (!seen.crashed) why.push(timedOut ? `nessuna sonda dopo ${TIMEOUT_MS / 1000} s` : 'nessuna sonda')
  } else {
    if (lab.frames < FRAMES) why.push(`${lab.frames} fotogrammi su ${FRAMES}`)
    // un fotogramma che passa non è un fotogramma disegnato: almeno un render ciascuno, a regime
    if (!(lab.rendersPerFrame >= 1))
      why.push(`la tela non viene disegnata: ${Number.isFinite(lab.rendersPerFrame) ? lab.rendersPerFrame.toFixed(2) : 'n/d'} render per fotogramma a regime`)
    // e un render non è un'immagine: la tela può disegnare e non arrivare allo schermo
    if (gain !== null && !(gain >= CANVAS_GAIN_MIN))
      why.push(`la tela non arriva allo schermo: il ritaglio con la tela pesa ${gain.toFixed(2)} volte quello senza (ne servono ${CANVAS_GAIN_MIN})`)
    if (lab.tier !== c.tier) why.push(`tier ${lab.tier}, il caso voleva ${c.tier}: il ramo non è stato aperto`)
    if (lab.physics !== c.physics)
      why.push(`fisica ${lab.physics ? 'accesa' : 'spenta'}, il caso la voleva ${c.physics ? 'accesa' : 'spenta'}`)
    why.push(...sceneWhy(lab))
  }
  // il download di rapier segue la fisica del CASO: spenta = nessun suo file, accesa = il motore
  // arriva. Il secondo è il controllo positivo: senza, un gate che non riconosce più il chunk
  // (nome, firma, percorso) direbbe «niente rapier» anche dove si scarica.
  const fetched = [...rapierFetched]
  if (!c.physics && fetched.length)
    why.push(`fisica spenta ma rapier è stato scaricato: ${fetched.map(describe).join(', ')}`)
  if (c.physics && !fetched.some(hasEngine))
    why.push(`fisica accesa ma nessuna richiesta del motore rapier (${[...rapierFiles.keys()].filter(hasEngine).join(', ')}): il gate non vede il file che vieta negli altri casi`)

  const size = `${c.ctx.viewport.width}×${c.ctx.viewport.height}${c.ctx.reducedMotion ? ' reduced' : ''}`
  const rapierGz = fetched.reduce((s, f) => s + rapierFiles.get(f).gz, 0)
  const download = fetched.length ? `rapier scaricato (${kb(rapierGz)} KB gzip)` : 'rapier non scaricato'
  const pixels = gain !== null ? ` · tela ×${gain.toFixed(1)} sul fondo` : ''
  const facts = lab
    ? `tier ${lab.tier} · fisica ${lab.physics ? 'accesa' : 'spenta'} · ${backend ?? 'backend?'} · ${lab.frames} fotogrammi · ${Number.isFinite(lab.rendersPerFrame) ? lab.rendersPerFrame.toFixed(1) : 'n/d'} render/fotogramma${pixels} · ${sceneFacts(lab)} · ${download}`
    : `${backend ?? 'backend?'} · nessuna sonda · ${download}`
  console.log(`${why.length ? '✗' : '✓'} ${c.name.padEnd(8)} ${size.padEnd(17)} ${facts}`)
  for (const w of why) console.log(`    ${w}`)
  return { c, lab, backend, why }
}

// Le promesse della scena, sulla sonda. Con la fisica: i corpi e le istanze cadono e restano
// sopra il terreno; la catena del Lanyard ha nel mondo i giunti che il markup dichiara, si muove e
// resta legata (nessuna corda oltre la sua lunghezza, l'aggancio della card chiuso), e PhysicsStep
// vede i passi. Senza: tutto nella posa del markup, nessun passo e nessun giunto. Un dato che manca
// (la card non trovata, la sonda senza corpi) è rosso, mai un verde per assenza.
function sceneWhy(lab) {
  const why = []
  const fmt = (n, d = 4) => (Number.isFinite(n) ? n.toFixed(d) : 'n/d')
  const fall = (what, startY, y) => {
    const drop = startY - y
    if (!Number.isFinite(drop)) why.push(`quota di ${what} non leggibile`)
    else if (lab.physics && drop < DROP_MIN) why.push(`fisica accesa ma ${what} non cade (quota ${y.toFixed(3)}, partenza ${startY})`)
    else if (lab.physics && !(y > lab.floorY))
      why.push(`fisica accesa ma ${what} sta sotto il terreno (quota ${y.toFixed(2)}, terreno ${lab.floorY}): nessun collider l'ha fermato`)
    else if (!lab.physics && Math.abs(drop) > STILL_TOL)
      why.push(`fisica spenta ma ${what} non è nella posa del markup (quota ${y.toFixed(4)}, nel markup ${startY})`)
  }
  if (!lab.bodies?.length || !lab.instances?.length || !lab.chain) why.push('la sonda non porta corpi, istanze e catena: è di un altro laboratorio')
  for (const b of lab.bodies ?? []) fall(`il corpo «${b.name}»`, b.startY, b.y)
  for (const [i, it] of (lab.instances ?? []).entries()) fall(`l'istanza ${i} di PhysicsInstancedBodies`, it.startY, it.y)
  const ch = lab.chain
  if (!ch) return why
  if (lab.physics) {
    if (!(ch.steps >= 1)) why.push('fisica accesa ma PhysicsStep non ha visto nessun passo del mondo')
    if (ch.joints !== ch.expected)
      why.push(`fisica accesa ma nel mondo ci sono ${ch.joints} giunti, il markup del Lanyard ne dichiara ${ch.expected}`)
    else if (ch.steps >= 1 && ch.measured !== ch.expected)
      why.push(`la sonda ha misurato ${ch.measured} giunti su ${ch.expected}: l'apertura sarebbe verde per assenza`)
    else {
      if (!(ch.stretch <= ROPE_STRETCH_TOL))
        why.push(`la catena non resta legata: una corda è andata oltre la sua lunghezza del ${fmt(ch.stretch * 100, 1)}% (tolleranza ${ROPE_STRETCH_TOL * 100}%)`)
      if (!(ch.gap <= HOOK_GAP_TOL))
        why.push(`la catena non resta legata: l'aggancio sferico della card si è aperto di ${fmt(ch.gap, 3)} (tolleranza ${HOOK_GAP_TOL})`)
    }
    if (!(ch.moved >= DROP_MIN)) why.push(`fisica accesa ma la catena non si muove (card spostata di ${fmt(ch.moved)})`)
  } else {
    if (ch.steps !== 0 || ch.joints !== 0) why.push(`fisica spenta ma il mondo c'è: ${ch.steps} passi, ${ch.joints} giunti`)
    if (!(Math.abs(ch.moved) <= STILL_TOL)) why.push(`fisica spenta ma la card si è mossa di ${fmt(ch.moved)}`)
  }
  return why
}

function sceneFacts(lab) {
  const fmt = (n, d) => (Number.isFinite(n) ? n.toFixed(d) : 'n/d')
  const fallen = (list) => (list ?? []).map((b) => `${b.startY.toFixed(2)}→${fmt(b.y, 2)}`).join(' ') || 'n/d'
  const ch = lab.chain
  const chain = ch
    ? `giunti ${ch.joints}/${ch.expected} · ${ch.steps} passi · corde +${fmt(ch.stretch * 100, 1)}% · aggancio ${fmt(ch.gap, 4)} · card ${fmt(ch.moved, 2)}`
    : 'catena n/d'
  return `corpi ${fallen(lab.bodies)} · istanze ${fallen(lab.instances)} · ${chain}`
}
