#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// indici-webgl.mjs: il gate dei VAO senza indici (three r185, ripiego WebGL2).
//
// Perché esiste. Il 21 ott 2026 SILKET sfarfallava al primo scroll su iPhone: scorrendo durante il
// caricamento, WebKit (WebGL2) dava `INVALID_OPERATION` su `drawElements` e parti della scena
// mancavano per un fotogramma. Il difetto è di three r185 (un buffer degli indici caricato col VAO
// di un altro oggetto legato gli toglie gli indici); la cura è src/canvas/indiciWebGL.ts, accesa da
// Stage. Nessun gate del kit lo vedeva: lo stato non tocca la GPU, i pixel di un fotogramma su
// sessanta non arrivano a un diff, il tempo per fotogramma non cambia. Si vede solo CONTANDO.
//
// Due canali, indipendenti. La sonda avvolge `drawElements` (e le varianti) e chiede al contesto
// se c'è un ELEMENT_ARRAY_BUFFER legato: è la causa, contata al disegno. La console di WebKit
// riporta gli INVALID_OPERATION che il browser stesso ha visto: è l'effetto. WebKit smette di
// scriverli dopo qualche decina per contesto, quindi il numero esatto è quello della sonda.
//
// Protocollo (WebKit a taglia iPhone 15: niente WebGPU in playwright, quindi il ripiego WebGL2,
// quello degli iPhone fino a iOS 18):
//  1. il laboratorio `?lab=indici` (src/lab/IndiciLab.tsx), che riproduce il difetto a comando,
//     per le due strade che la cura avvolge (`via=crea`, `via=aggiorna`): con la cura spenta
//     (`indici=nudi`) DEVE contare disegni senza indici, con la cura accesa zero;
//  2. la pagina, `--giri` volte in un contesto nuovo: lo scroll parte al PRIMO disegno indicizzato,
//     cioè mentre la scena si sta ancora compilando, e attraversa la pagina in `--secondi`. Zero e
//     zero. Partire alla comparsa del canvas non bastava: il 21 ott, sulla build di SILKET dopo la
//     cura, un giro freddo aveva scorso tutta la pagina vedendo UN disegno, e passava.
// Un giro è valido solo se ha visto quello che dice: motore WebGL2, cura nello stato atteso (nei
// siti del kit, dal log di Stage), almeno `MIN_DISEGNI` disegni indicizzati. Altrimenti esce 1
// dicendo che cosa non ha visto.
//
// GATE-NEGATIVO: è dentro ogni giro (punto 1). Visto il 21 ott 2026 sul laboratorio con
// `indici=nudi`: 196 (crea) e 181 (aggiorna) disegni senza indici in 3 s, uno per fotogramma, e
// la console di WebKit che ne conferma 16 a testa (poi smette di scriverli); con la cura, 0 e 0.
// Sul difetto vero, in modalità `--solo-pagina`: la build di SILKET prima della cura (b6e7f93)
// dava 2 disegni senza indici in 2 giri su 3, quella dopo (9c9c480) 0 su 3. Il giorno che il nudo
// smette di sbagliare, il gate esce 1: o three ha corretto il difetto (e la cura si toglie), o la
// sonda è diventata cieca.
//
// Uso:
//   npm run qa:indici                                       # dev server del kit: laboratorio + pagina
//   node scripts/indici-webgl.mjs <url> --solo-pagina       # un sito qualunque (anche in rete)
//   opzioni: --giri=3  --secondi=12
// ─────────────────────────────────────────────────────────────────────────────
import { webkit, devices } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { percorsoBrowser } from './_browser.mjs'

const argv = process.argv.slice(2)
const base = argv.filter((a) => a.startsWith('http')).at(-1) ?? 'http://127.0.0.1:5199/'
const soloPagina = argv.includes('--solo-pagina')
const opzione = (nome, def) => Number(argv.find((a) => a.startsWith(`--${nome}=`))?.split('=')[1] ?? def)
const GIRI = opzione('giri', 3)
const SECONDI = opzione('secondi', 12)
const LAB_MS = 3000 // fotogrammi di laboratorio per strada: a 60 fps sono ~180 occasioni
// Sotto, il giro non ha visto la scena abbastanza da dire qualcosa (un oggetto indicizzato a
// 60 fps ne fa 100 in meno di 2 s)
const MIN_DISEGNI = 100

/** Iniettata prima di ogni script della pagina. */
function sonda() {
  const c = (window.__indici = { contesti: 0, disegni: 0, senzaIndici: 0, esempi: [] })
  const tela = window.HTMLCanvasElement?.prototype
  if (tela) {
    const getContext = tela.getContext
    tela.getContext = function (tipo, ...resto) {
      const ctx = getContext.call(this, tipo, ...resto)
      if (ctx && tipo === 'webgl2') c.contesti++
      return ctx
    }
  }
  const gl2 = window.WebGL2RenderingContext?.prototype
  if (!gl2) return
  for (const nome of ['drawElements', 'drawElementsInstanced', 'drawRangeElements']) {
    const orig = gl2[nome]
    if (!orig) continue
    gl2[nome] = function (...a) {
      c.disegni++
      if (this.getParameter(this.ELEMENT_ARRAY_BUFFER_BINDING) === null) {
        c.senzaIndici++
        if (c.esempi.length < 3) {
          c.esempi.push(`${nome} a ${Math.round(performance.now())} ms, scroll ${Math.round(scrollY)} px`)
        }
      }
      return orig.apply(this, a)
    }
  }
}

const browser = await webkit.launch({ headless: true, executablePath: percorsoBrowser('webkit') })

/** Una visita: apre `url`, fa `azione(page)`, raccoglie sonda e console. */
async function visita(url, azione) {
  const contesto = await browser.newContext({ ...devices['iPhone 15'] })
  const page = await contesto.newPage()
  const esito = { url, backend: '?', cura: '?', laboratorio: false, console: 0, messaggi: [], errori: [] }
  page.on('console', (m) => {
    const t = m.text()
    if (t.includes('renderer backend:')) esito.backend = t.split('renderer backend:')[1].trim()
    if (t.includes('[kit] indici WebGL2:')) esito.cura = t.split('[kit] indici WebGL2:')[1].trim().split(' ')[0]
    if (t.includes('[kit] laboratorio indici:')) esito.laboratorio = true
    if (t.includes('INVALID_OPERATION')) {
      esito.console++
      // il testo dice QUALE chiamata: un INVALID_OPERATION che non è un disegno senza indici è
      // un altro difetto, e il rapporto deve poterlo distinguere
      if (esito.messaggi.length < 3 && !esito.messaggi.includes(t)) esito.messaggi.push(t.slice(0, 160))
    }
  })
  page.on('pageerror', (e) => esito.errori.push(e.message.slice(0, 200)))
  await page.addInitScript(sonda)
  await page.goto(url, { waitUntil: 'commit', timeout: 60000 })
  await page.waitForSelector('canvas', { timeout: 60000 })
  await azione(page)
  Object.assign(esito, await page.evaluate(() => window.__indici))
  await contesto.close()
  return esito
}

/** Lo scroll di chi arriva e scorre subito: dal primo disegno, un passo per fotogramma fino in fondo. */
const scorri = (secondi) => async (page) => {
  await page.waitForFunction(() => window.__indici?.disegni > 0, null, { timeout: 60000 }).catch(() => {})
  await page.evaluate(async (s) => {
    const H = Math.max(0, document.documentElement.scrollHeight - innerHeight)
    const inizio = performance.now()
    await new Promise((fine) => {
      const passo = () => {
        const f = Math.min(1, (performance.now() - inizio) / (s * 1000))
        window.scrollTo(0, H * f)
        if (f < 1) requestAnimationFrame(passo)
        else fine()
      }
      requestAnimationFrame(passo)
    })
  }, secondi)
  await page.waitForTimeout(1000)
}

const fallimenti = []
const righe = []
const indirizzo = (query) => {
  const u = new URL(base)
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v)
  return u.toString()
}

try {
  if (!soloPagina) {
    for (const via of ['crea', 'aggiorna']) {
      for (const nuda of [true, false]) {
        const url = indirizzo(nuda ? { lab: 'indici', via, indici: 'nudi' } : { lab: 'indici', via })
        const e = await visita(url, (page) => page.waitForTimeout(LAB_MS))
        const nome = `laboratorio via=${via} cura ${nuda ? 'SPENTA' : 'accesa'}`
        righe.push({ nome, ...e })
        const atteso = nuda ? 'spenta' : 'accesa'
        if (!e.laboratorio) {
          fallimenti.push(`${nome}: la pagina ?lab=indici non è il laboratorio (manca src/lab/IndiciLab.tsx in questo sito?): per un sito usa --solo-pagina`)
          continue
        }
        if (e.backend !== 'WebGL2') fallimenti.push(`${nome}: motore «${e.backend}», il gate misura il ripiego WebGL2`)
        if (e.cura !== atteso) fallimenti.push(`${nome}: la cura risulta «${e.cura}», attesa «${atteso}»`)
        if (e.disegni < MIN_DISEGNI) fallimenti.push(`${nome}: ${e.disegni} disegni indicizzati (minimo ${MIN_DISEGNI}), la sonda non ha visto il laboratorio`)
        if (nuda && !e.senzaIndici) {
          fallimenti.push(`${nome}: zero disegni senza indici con la cura spenta. O three ha corretto il difetto (riverifica e togli indiciWebGL.ts) o la sonda è cieca`)
        }
        if (!nuda && (e.senzaIndici || e.console)) {
          fallimenti.push(`${nome}: ${e.senzaIndici} disegni senza indici, ${e.console} INVALID_OPERATION in console con la cura accesa`)
        }
      }
    }
  }
  for (let giro = 1; giro <= GIRI; giro++) {
    const e = await visita(base, scorri(SECONDI))
    const nome = `pagina, giro ${giro}/${GIRI} (scroll di ${SECONDI} s durante il caricamento)`
    righe.push({ nome, ...e })
    if (!e.contesti || e.disegni < MIN_DISEGNI) {
      fallimenti.push(`${nome}: ${e.contesti} contesti WebGL2, ${e.disegni} disegni indicizzati (minimo ${MIN_DISEGNI}): non ha visto la scena, il giro non vale`)
    }
    if (e.senzaIndici || e.console) {
      fallimenti.push(`${nome}: ${e.senzaIndici} disegni senza indici, ${e.console} INVALID_OPERATION in console`)
    }
    if (e.cura === 'interni-mancanti') fallimenti.push(`${nome}: la cura non si applica più (three ha cambiato gli interni)`)
  }
} finally {
  await browser.close()
}

console.log(`\n# VAO senza indici: WebKit a taglia iPhone 15 (WebGL2) · ${base}\n`)
console.log('| visita | motore | cura | disegni indicizzati | senza indici | INVALID_OPERATION in console |')
console.log('|---|---|---|---|---|---|')
for (const r of righe) {
  console.log(`| ${r.nome} | ${r.backend} | ${r.cura} | ${r.disegni} | ${r.senzaIndici} | ${r.console} |`)
}
for (const r of righe) {
  for (const x of r.esempi ?? []) console.log(`  · ${r.nome}: ${x}`)
  for (const x of r.messaggi ?? []) console.log(`  · ${r.nome}: console «${x}»`)
  for (const x of r.errori) console.log(`  ✗ ${r.nome}: errore di pagina: ${x}`)
}
mkdirSync('qa', { recursive: true })
writeFileSync('qa/indici.json', JSON.stringify({ base, giri: GIRI, secondi: SECONDI, righe }, null, 2) + '\n')
console.log('\n→ qa/indici.json')
if (fallimenti.length) {
  console.log(`\n✗ ${fallimenti.length} problemi:`)
  for (const f of fallimenti) console.log(`  · ${f}`)
  process.exit(1)
}
console.log('\n✓ nessun disegno senza indici')
