#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// compilazioni.mjs: quanti programmi GPU nascono mentre il dito scorre, e quanti sono COPIE.
//
// Portato da SILKET (scripts/compilazioni.mjs, 23 set 2026). Su un Mac un programma costa un paio
// di ms e nessun cronometro lo vede; su un iPhone col ripiego WebGL2 la traduzione GLSL → Metal
// costa cento volte tanto, e SILKET aveva blocchi da 150 ms a 1,3 s dentro il gesto, con tutti i
// gate verdi. Il numero che conta non è un tempo, è un CONTEGGIO: deterministico, uguale col Mac
// scarico o in ginocchio, e zero è la risposta giusta.
//
// Due misure.
//  1. **Nati scorrendo.** Si apre la pagina a taglia iPhone 15, si aspetta che per `QUIETE_MS` non
//     nasca più niente (non un tempo fisso: su una macchina lenta si misurerebbe a metà), poi si
//     scorre tutta la pagina a velocità costante e si conta ciò che nasce. Zero, o la scena
//     compila addosso a chi scorre: serve un riscaldamento (ricetta nella skill
//     web3d-integration-patterns, codice di riferimento `PreRiscaldamento` di SILKET).
//  2. **Famiglie.** Programmi il cui sorgente è IDENTICO a meno dei numeri. Un numero JS dentro un
//     grafo TSL diventa un letterale nello shader (`float(scala)`, `clamp(x, 0, angolo)`): un
//     materiale per parte con le proprie misure cotte dentro è un programma per parte. SILKET,
//     21 ott 2026: 98 vertex shader distinti contro 28 fragment, la firma di un `positionNode` con
//     le misure cotte; con le misure in `uniform` 157 → 72 programmi, pixel identici. Il controllo
//     confronta i sorgenti a numeri sostituiti (i numeri DENTRO un nome, come `NodeBuffer_307136`,
//     restano: sono un'altra cosa) e una famiglia di `FAMIGLIA_MAX + 1` o più esce 1.
//
// Due motori, perché i percorsi sono due: WebKit (niente WebGPU in playwright → ripiego WebGL2,
// quello degli iPhone fino a iOS 18) e Chromium con WebGPU. La logica che decide COSA compilare è
// di three, non del browser.
//
// GATE-NEGATIVO. Per i nati scorrendo: `--subito` scorre appena compare il canvas, prima che la
// scena sia compilata, e il gate deve uscire 1 nominando i programmi (21 ott 2026 sulla demo: 1
// programma su WebKit, 2 moduli e 2 pipeline su Chromium, all'80% della pagina, anche SENZA
// `--subito` finché il kit non aveva `Riscaldamento`). Per le famiglie il negativo è dentro ogni
// giro: il laboratorio `?lab=costanti&costanti=cotte` (src/lab/CostantiLab.tsx) cuoce sei misure
// come letterali e il controllo DEVE nominare la famiglia; lo stesso laboratorio con le misure in
// uniform, e con le fabbriche del kit, non deve averne. Se il cotto smette di fare famiglia, il
// controllo è cieco e il gate esce 1.
//
// Uso:
//   npm run qa:compilazioni                          # dev server del kit: pagina + laboratorio
//   node scripts/compilazioni.mjs <url> --solo-pagina   # un indirizzo qualunque, anche in rete
//   node scripts/compilazioni.mjs <url> --subito     # negativo dei nati scorrendo
//   node scripts/compilazioni.mjs <url> --motore=webkit|chromium
// ─────────────────────────────────────────────────────────────────────────────
import { webkit, chromium, devices } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { percorsoBrowser } from './_browser.mjs'

const argv = process.argv.slice(2)
const url = argv.filter((a) => a.startsWith('http')).at(-1) ?? 'http://127.0.0.1:5199/'
const subito = argv.includes('--subito')
const soloPagina = argv.includes('--solo-pagina')
const sceltaMotore = (argv.find((a) => a.startsWith('--motore=')) ?? '--motore=entrambi').split('=')[1]
const motori = sceltaMotore === 'entrambi' ? ['webkit', 'chromium'] : [sceltaMotore]

// Tolleranza: zero. Un programma che nasce scorrendo è un blocco sul telefono, e un tetto «di
// qualche unità» diventerebbe il posto dove i prossimi si nascondono.
const SOGLIA = 0
// Due materiali che differiscono per un numero sono un caso; quattro sono una fabbrica di
// materiali con le misure cotte, cioè il difetto.
const FAMIGLIA_MAX = 3
const QUIETE_MS = 4000
const ATTESA_MAX_MS = 90000
const SCROLL_S = 30

/** Contatori iniettati prima di ogni script della pagina. */
function sonda() {
  const c = (window.__compilazioni = { programmi: 0, moduli: 0, pipeline: 0, eventi: [], sorgenti: [] })
  const altezza = () => Math.max(1, document.documentElement.scrollHeight - innerHeight)
  const conta = (chiave) => {
    c[chiave]++
    c.eventi.push([chiave, Math.round((scrollY / altezza()) * 1000) / 1000])
  }
  const gl2 = window.WebGL2RenderingContext?.prototype
  if (gl2) {
    const link = gl2.linkProgram
    gl2.linkProgram = function (...a) { conta('programmi'); return link.apply(this, a) }
    const tipi = new WeakMap()
    const crea = gl2.createShader
    gl2.createShader = function (tipo) {
      const s = crea.call(this, tipo)
      if (s) tipi.set(s, tipo === this.VERTEX_SHADER ? 'vertex' : 'fragment')
      return s
    }
    const sorgente = gl2.shaderSource
    gl2.shaderSource = function (s, testo) {
      c.sorgenti.push([tipi.get(s) ?? '?', testo])
      return sorgente.call(this, s, testo)
    }
  }
  const gpu = window.GPUDevice?.prototype
  if (gpu) {
    const modulo = gpu.createShaderModule
    gpu.createShaderModule = function (d) {
      conta('moduli')
      // three etichetta i moduli con lo stadio: "vertex…", "fragment…", "compute…"
      const etichetta = typeof d?.label === 'string' ? d.label : 'senza-etichetta'
      const stadio = /^(vertex|fragment|compute)/.exec(etichetta)?.[1] ?? 'altro'
      // un modulo senza codice non entra nel confronto come stringa vuota: lo si conta a parte
      c.sorgenti.push([stadio, typeof d?.code === 'string' ? d.code : null])
      return modulo.call(this, d)
    }
    for (const nome of ['createRenderPipeline', 'createRenderPipelineAsync']) {
      const orig = gpu[nome]
      gpu[nome] = function (...a) { conta('pipeline'); return orig.apply(this, a) }
    }
  }
}

const leggi = (page) => page.evaluate(() => {
  const { programmi, moduli, pipeline } = window.__compilazioni
  return { programmi, moduli, pipeline, totale: programmi + moduli + pipeline }
})

// Un letterale numerico che non fa parte di un nome: `0.35`, `1.`, `.5`, `2e-3`, `4u`, `1.0f`.
const LETTERALE = /(?<![\w.])(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?[fhiu]?(?![\w.])/g

/**
 * Le famiglie: sorgenti distinti dello stesso stadio che diventano uguali a numeri sostituiti.
 * Per ognuna, il primo letterale che cambia, col suo intorno, per dire dove guardare.
 */
export function famiglie(sorgenti) {
  const distinti = new Map() // stadio → Set di sorgenti
  let senzaCodice = 0
  for (const [stadio, testo] of sorgenti) {
    if (typeof testo !== 'string') {
      senzaCodice++
      continue
    }
    if (!distinti.has(stadio)) distinti.set(stadio, new Set())
    distinti.get(stadio).add(testo)
  }
  const perStadio = {}
  const trovate = []
  for (const [stadio, insieme] of distinti) {
    perStadio[stadio] = insieme.size
    const gruppi = new Map()
    for (const testo of insieme) {
      const chiave = testo.replace(LETTERALE, '#')
      if (!gruppi.has(chiave)) gruppi.set(chiave, [])
      gruppi.get(chiave).push(testo)
    }
    for (const membri of gruppi.values()) {
      if (membri.length < 2) continue
      const letterali = membri.map((t) => [...t.matchAll(LETTERALE)])
      const diversi = []
      for (let i = 0; i < letterali[0].length; i++) {
        const valori = new Set(letterali.map((l) => l[i]?.[0]))
        if (valori.size > 1) diversi.push(i)
      }
      const primo = letterali[0][diversi[0]]
      const intorno = primo
        ? membri[0].slice(Math.max(0, primo.index - 60), primo.index + 20).replace(/\s+/g, ' ').trim()
        : ''
      trovate.push({
        stadio,
        programmi: membri.length,
        letteraliDiversi: diversi.length,
        valori: diversi.slice(0, 3).map((i) => letterali.map((l) => l[i]?.[0]).slice(0, 6).join(' | ')),
        intorno,
      })
    }
  }
  trovate.sort((a, b) => b.programmi - a.programmi)
  return { perStadio, trovate, senzaCodice, sorgenti: sorgenti.length }
}

/**
 * Un worktree col node_modules collegato fuori dalla radice: Vite serve i file del pacchetto dal
 * loro percorso vero sotto `/@fs/` e li nega (403), perché stanno fuori da `server.fs.allow`. Nel
 * checkout principale gli stessi file escono 200 (i font di KaTeX, 21 ott 2026). È l'unico 4xx che
 * il gate non conta come errore: qualunque altro cambierebbe la scena che si misura.
 */
const artefattoWorktree = (stato, indirizzo) =>
  stato === 403 && indirizzo.includes('/@fs/') && indirizzo.includes('/node_modules/')

async function misura(motore, url, { scorri = true } = {}) {
  const tipo = motore === 'chromium' ? chromium : webkit
  const browser = await tipo.launch({
    headless: true,
    executablePath: motore === 'chromium' ? percorsoBrowser('chromium') : percorsoBrowser('webkit'),
    args: motore === 'chromium' ? ['--enable-unsafe-webgpu', '--use-angle=metal'] : [],
  })
  const page = await (await browser.newContext({ ...devices['iPhone 15'] })).newPage()
  const errori = []
  const avvisi = []
  let backend = '?'
  page.on('console', (m) => {
    const t = m.text()
    if (t.includes('renderer backend:')) backend = t.split('renderer backend:')[1].trim()
    // «Failed to load resource» non dice quale: la risposta sotto lo dice con l'indirizzo
    if (m.type() === 'error' && !t.startsWith('Failed to load resource')) errori.push(t.slice(0, 200))
  })
  page.on('response', (r) => {
    if (r.status() < 400) return
    const riga = `risposta ${r.status()} per ${r.url().slice(0, 160)}`
    if (artefattoWorktree(r.status(), r.url())) avvisi.push(riga)
    else errori.push(riga)
  })
  page.on('pageerror', (e) => errori.push(e.message.slice(0, 200)))
  await page.addInitScript(sonda)
  await page.goto(url, { waitUntil: 'load', timeout: 60000 })
  await page.waitForSelector('canvas', { timeout: 60000 })

  // Il caricamento è finito quando smette di nascere roba, non dopo N secondi.
  const t0 = Date.now()
  let ultimo = await leggi(page)
  let fermoDa = Date.now()
  while (!subito && Date.now() - t0 < ATTESA_MAX_MS) {
    await page.waitForTimeout(500)
    const ora = await leggi(page)
    if (ora.totale !== ultimo.totale) { ultimo = ora; fermoDa = Date.now() }
    if (Date.now() - fermoDa >= QUIETE_MS) break
  }
  const caldo = !subito && Date.now() - t0 < ATTESA_MAX_MS
  const prima = await leggi(page)
  await page.evaluate(() => { window.__compilazioni.eventi.length = 0 })

  if (scorri) await page.evaluate(async (secondi) => {
    const H = Math.max(0, document.documentElement.scrollHeight - innerHeight)
    const inizio = performance.now()
    await new Promise((fine) => {
      const passo = () => {
        const f = Math.min(1, (performance.now() - inizio) / (secondi * 1000))
        window.scrollTo(0, H * f)
        if (f < 1) requestAnimationFrame(passo); else fine()
      }
      requestAnimationFrame(passo)
    })
  }, SCROLL_S)
  await page.waitForTimeout(500)
  const dopo = await leggi(page)
  const eventi = await page.evaluate(() => window.__compilazioni.eventi)
  const sorgenti = await page.evaluate(() => window.__compilazioni.sorgenti)
  await browser.close()

  const nati = {
    programmi: dopo.programmi - prima.programmi,
    moduli: dopo.moduli - prima.moduli,
    pipeline: dopo.pipeline - prima.pipeline,
  }
  const decimi = Array.from({ length: 10 }, () => 0)
  for (const [, f] of eventi) decimi[Math.min(9, Math.floor(f * 10))]++
  // Silenzio = guasto. Una corsa che non vede NESSUNA compilazione (né al caricamento né
  // scorrendo) non dice «zero nati scorrendo»: dice che la sonda è cieca o che la pagina non ha
  // scena, e passerebbe proprio quando non ha misurato niente.
  if (dopo.totale === 0) errori.push('nessuna compilazione vista in tutta la corsa: sonda cieca o pagina senza scena')
  const fam = famiglie(sorgenti)
  if (dopo.totale > 0 && fam.sorgenti === 0) errori.push('compilazioni contate ma nessun sorgente letto: il controllo delle famiglie non ha visto niente')
  if (fam.senzaCodice) errori.push(`${fam.senzaCodice} moduli senza codice leggibile: le famiglie non li vedono`)
  return {
    motore, backend, caldo,
    caricamento: { programmi: prima.programmi, moduli: prima.moduli, pipeline: prima.pipeline, secondi: Math.round((Date.now() - t0) / 1000) },
    natiScorrendo: nati, perDecimo: decimi, famiglie: fam, errori, avvisi,
  }
}

const conQuery = (query) => {
  const u = new URL(url)
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v)
  return u.toString()
}

const risultati = []
const laboratori = []
const problemi = []
for (const m of motori) {
  risultati.push(await misura(m, url))
  if (soloPagina || subito) continue
  // il negativo delle famiglie: le misure cotte DEVONO fare famiglia, quelle in uniform no
  const cotto = await misura(m, conQuery({ lab: 'costanti', costanti: 'cotte' }), { scorri: false })
  const pulito = await misura(m, conQuery({ lab: 'costanti' }), { scorri: false })
  const famigliaCotta = Math.max(0, ...cotto.famiglie.trovate.map((f) => f.programmi))
  const famigliaPulita = Math.max(0, ...pulito.famiglie.trovate.map((f) => f.programmi))
  laboratori.push({ motore: m, cotto: cotto.famiglie, pulito: pulito.famiglie })
  console.log(`${m}: laboratorio costanti, famiglia più grande ${famigliaCotta} con le misure cotte, ${famigliaPulita} in uniform (sorgenti ${JSON.stringify(pulito.famiglie.perStadio)})`)
  for (const f of cotto.famiglie.trovate.slice(0, 2)) {
    console.log(`   cotto, famiglia ${f.stadio} di ${f.programmi}: valori ${f.valori.join(' / ')}`)
  }
  if (famigliaCotta <= FAMIGLIA_MAX) {
    problemi.push(`${m}: il laboratorio con le misure cotte non fa famiglia (${famigliaCotta}), il controllo è cieco`)
  }
  if (famigliaPulita > 1) {
    problemi.push(`${m}: il laboratorio con le misure in uniform fa una famiglia di ${famigliaPulita}: una fabbrica del kit cuoce i suoi numeri`)
  }
  for (const r of [cotto, pulito]) for (const e of r.errori) problemi.push(`${m} laboratorio: ${e}`)
}

let fallito = problemi.length > 0
console.log(`\n# Compilazioni: iPhone 15 · ${url}${subito ? ' · --subito (GATE-NEGATIVO)' : ''}\n`)
for (const r of risultati) {
  const n = r.natiScorrendo
  const tot = n.programmi + n.moduli + n.pipeline
  const copie = r.famiglie.trovate.filter((f) => f.programmi > FAMIGLIA_MAX)
  const esito = tot > SOGLIA || copie.length > 0 || r.errori.length > 0 || (!subito && !r.caldo)
  if (esito) fallito = true
  const c = r.caricamento
  console.log(`${esito ? '✗' : '✓'} ${r.motore} (${r.backend}): al caricamento ${c.programmi} programmi, ${c.moduli} moduli, ${c.pipeline} pipeline in ${c.secondi} s${r.caldo ? '' : subito ? ' (non atteso)' : ', NON finito entro il tetto'}`)
  console.log(`   nati scorrendo: ${n.programmi} programmi, ${n.moduli} moduli shader, ${n.pipeline} pipeline (soglia ${SOGLIA})`)
  if (tot) console.log(`   per decimo di pagina: ${r.perDecimo.map((x, i) => `${i * 10}%:${x}`).filter((s) => !s.endsWith(':0')).join('  ')}`)
  const stadi = Object.entries(r.famiglie.perStadio).map(([s, k]) => `${k} ${s}`).join(', ')
  console.log(`   sorgenti distinti: ${stadi || 'nessuno'}`)
  for (const f of r.famiglie.trovate.slice(0, 5)) {
    console.log(`   ${f.programmi > FAMIGLIA_MAX ? '✗' : '·'} famiglia ${f.stadio}: ${f.programmi} sorgenti uguali a meno di ${f.letteraliDiversi} numeri (tetto ${FAMIGLIA_MAX})`)
    for (const v of f.valori) console.log(`       valori: ${v}`)
    if (f.intorno) console.log(`       dove: …${f.intorno}…`)
  }
  for (const e of r.errori.slice(0, 5)) console.log(`   errore: ${e}`)
  if (r.avvisi.length) console.log(`   avviso: ${r.avvisi.length} file di node_modules negati da Vite fuori dalla radice del worktree (non contano)`)
}
for (const p of problemi) console.log(`✗ ${p}`)
mkdirSync('qa', { recursive: true })
writeFileSync('qa/compilazioni.json', JSON.stringify({ url, subito, risultati, laboratori }, null, 2) + '\n')
console.log('\n→ qa/compilazioni.json')
process.exit(fallito ? 1 : 0)
