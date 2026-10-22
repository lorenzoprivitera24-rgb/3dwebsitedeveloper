#!/usr/bin/env node
// GATE-NEGATIVO (22 ott 2026, demo in dev, Chromium headless WebGPU come gira qa:shoot): con la
// rivelazione di Stage che lasciava la tela a opacity 0 (i render continuano, a schermo il solo
// DOM) la guardia di prima, la soglia assoluta di 0,02 B/px, restava VERDE: 42 scatti su 42 sopra
// soglia, il più povero a 0,0437 B/px (pointer-1440; a 390 0,0918, a 834 0,0499), 0 errori,
// exit 0. La guardia differenziale sullo stesso sabotaggio: 42 rossi su 42, tutti e soli con «la
// tela non arriva allo schermo, da sola sul fondo nero pesa 1.00 volte il fondo senza tela»,
// exit 1; sul codice vero 42 verdi in due giri, da ×12,5 (strip-1440) a ×79, exit 0, e con
// --reduced 42 verdi da ×23 a ×57. Misura a parte su WebKit
// (WebGL2, 42 scatti): con la tela a opacity 0 la soglia di prima non scendeva sotto 0,070 B/px,
// e un PNG nero e piatto di WebKit pesa già 0,019-0,023 B/px, cioè la soglia stava sotto il rumore
// del suo codificatore; la sonda nuova lì va da ×4,8 a ×29. Secondo negativo, lo stesso giorno: col
// layer 3D che non arriva mai (il lazy di CanvasLayer in App che non si risolve, pagina ferma sul
// poster) 42 rossi su 42, tutti e soli con «nessuna tela nel layer 3D», exit 1.
// shoot.mjs — QA visiva deterministica (S6): scrolla il sito sezione per sezione, scatta
// screenshot a 3 breakpoint, raccoglie errori console/richieste fallite.
// Output: qa/shots/<sezione>-<larghezza>.png + qa/shots/report.json (exit 1 se errori).
//
// Uso: npm run qa:shoot            (dev server già attivo su 127.0.0.1:5199, FUORI sandbox)
//      node scripts/shoot.mjs http://127.0.0.1:5199/
// Le sezioni = <main> section[id]. Browser: playwright-core + Chrome for Testing in cache
// (il Chrome dell'utente NON raggiunge i server locali su questa macchina — fatto verificato).
//
// GUARDIA TELA ALLO SCHERMO («canvas-vuoto»): è il modo documentato in cui questo gate mente. La
// tela può disegnare ogni fotogramma e non arrivare allo schermo (headless Chrome che non presenta
// il canvas WebGPU al compositore, la rivelazione di Stage ferma a opacity 0, il renderer partito
// dopo l'attesa): lo screenshot RIESCE, qa:diff confronta il solo DOM e il report resta verde.
// Fino al 22 ott 2026 la guardia era una soglia assoluta, sotto 0,02 byte di PNG per pixel lo
// scatto era «piatto»: sulla demo non scattava mai, perché sopra la tela c'è il DOM delle sezioni e
// il fondo del body non è piatto (i numeri nel GATE-NEGATIVO). Ora è differenziale, come in
// lab-gate.mjs: dopo ogni scatto la stessa inquadratura due volte, la sola tela del renderer su un
// fondo nero piatto e poi lo stesso fondo senza la tela, e si dividono i byte dei due PNG. Una tela
// che non arriva allo schermo dà 1 esatto (le due immagini sono la stessa), la scena almeno 4,7.
// DOM e fondo si nascondono invece di cercare un ritaglio libero perché un ritaglio libero non
// c'è: nei capitoli prodotto il DOM copre tutta la tela (scatto con e senza tela: 1,00), altrove si
// sposta per sezione e per progetto, e il solo gradiente del body pesa fino a 0,55 B/px su WebKit.
// La sonda non scrive file: in qa/shots restano gli scatti veri, quelli che qa:diff confronta.
// Con --headed si usa la GPU vera.
import { chromium } from 'playwright-core'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'

// --reduced: stessa passata con `prefers-reduced-motion: reduce`. Il path ridotto è nella
// definizione di «done» del kit ma nessuno lo guardava mai: senza emulazione si verifica solo
// il ramo animato, e i fallback statici marciscono in silenzio.
const REDUCED = process.argv.includes('--reduced')
const url = process.argv.slice(2).find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5199/'
const headed = process.argv.includes('--headed')
// La tela da sola sul nero divisa il nero senza tela, in byte di PNG: vuota 1,00, la scena della
// demo da ×12,5 a ×79 su Chromium e da ×4,8 a ×29 su WebKit (22 ott 2026, 42 scatti per motore).
const CANVAS_GAIN_MIN = 2
// Il foglio della sonda: spariscono il DOM e il fondo del body, resta la tela marcata. Il DOM si
// nasconde con visibility e non con display, così la pagina non cambia layout e lo scroll resta.
const SONDA_CSS =
  'html, body { background: #000 !important } body * { visibility: hidden !important } ' +
  'canvas[data-sonda-tela] { visibility: visible !important }'
const OUT = 'qa/shots'
const BREAKPOINTS = [
  { width: 390, height: 844 },   // mobile
  { width: 834, height: 1194 },  // tablet
  { width: 1440, height: 900 },  // desktop
]
const exe =
  process.env.CHROMIUM_PATH ??
  `${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`

// Ripulisci PRIMA di scattare. Senza questo, una sezione rinominata o rimossa lascia il suo
// vecchio scatto nella cartella: `qa:diff` continua a confrontarlo con la baseline e a dichiararlo
// PASS per sempre — un verde che certifica una sezione che non esiste più.
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({
  executablePath: exe,
  headless: !headed,
  args: ['--enable-unsafe-webgpu', '--use-angle=metal'],
})

const report = { url, reduced: REDUCED, startedAt: null, breakpoints: [], errors: [], shots: [] }
try {
  for (const bp of BREAKPOINTS) {
    const page = await browser.newPage({
      viewport: bp,
      ...(REDUCED ? { reducedMotion: 'reduce' } : {}),
    })
    const errors = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`) })
    page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))
    page.on('requestfailed', (r) => errors.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText ?? ''}`))

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(3500) // init renderer + IBL/PMREM

    const sections = await page.$$eval('main section[id]', (els) => els.map((el) => el.id))
    if (sections.length === 0) errors.push('[shoot] nessuna <main> section[id] trovata')

    for (const id of sections) {
      // Lenis root-mode anima lo scroll nativo: lo scrollIntoView istantaneo è letto da
      // ScrollTrigger senza bisogno di API Lenis; il timeout lascia assestare scrub/lazy.
      await page.evaluate((sid) => {
        document.getElementById(sid)?.scrollIntoView({ behavior: 'instant', block: 'start' })
      }, id)
      await page.waitForTimeout(1700) // > della piu' lunga entrata (scramble 1.1s + revealDelay)
      const file = `${OUT}/${REDUCED ? 'reduced-' : ''}${id}-${bp.width}.png`
      await page.screenshot({ path: file })
      const gain = await telaSulFondo(page)
      if (gain === null)
        errors.push(
          `[canvas-vuoto] ${file}: nessuna tela nel layer 3D (.canvas-layer canvas), lo scatto ha il solo DOM: ` +
            `renderer caduto sul poster o partito dopo l'attesa.`,
        )
      else if (!(gain >= CANVAS_GAIN_MIN))
        errors.push(
          `[canvas-vuoto] ${file}: la tela non arriva allo schermo, da sola sul fondo nero pesa ${gain.toFixed(2)} ` +
            `volte il fondo senza tela (ne servono ${CANVAS_GAIN_MIN}). Cause note: WebGPU headless che non presenta ` +
            `il canvas al compositore (rilancia con --headed), la rivelazione di Stage non scattata, il renderer partito dopo l'attesa.`,
        )
      report.shots.push({ file, canvasGain: gain === null ? null : +gain.toFixed(2) })
    }

    report.breakpoints.push({ ...bp, sections, errors })
    report.errors.push(...errors)
    await page.close()
  }
} finally {
  await browser.close()
}

writeFileSync(`${OUT}/${REDUCED ? 'report-reduced' : 'report'}.json`, JSON.stringify(report, null, 2))
const gains = report.shots.map((s) => s.canvasGain).filter((g) => g !== null)
const tela = gains.length ? ` · tela sul fondo da ×${Math.min(...gains).toFixed(2)} a ×${Math.max(...gains).toFixed(1)}` : ''
console.log(`✓ ${report.shots.length} screenshot in ${OUT}/${tela} · errori: ${report.errors.length}`)
for (const e of report.errors.slice(0, 10)) console.log('  ', e)
if (report.errors.length > 0) process.exitCode = 1

// Byte di PNG della sola tela del renderer sul fondo nero, divisi quelli dello stesso fondo senza
// la tela; null se la tela non c'è. La tela del renderer è la più grande dentro .canvas-layer: in
// dev, sul ripiego WebGL2, c'è anche quella dei grafici di r3f-perf. Rimette la pagina com'era.
async function telaSulFondo(page) {
  const trovata = await page.evaluate(() => {
    const tele = [...document.querySelectorAll('.canvas-layer canvas')].filter((c) => c.clientWidth * c.clientHeight > 0)
    tele.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)
    tele[0]?.setAttribute('data-sonda-tela', '')
    return tele.length > 0
  })
  if (!trovata) return null
  const foglio = await page.addStyleTag({ content: SONDA_CSS })
  // lo scatto dopo due fotogrammi, quando lo stile appena cambiato è a schermo (al più mezzo secondo)
  const peso = async () => {
    await page.evaluate(
      () =>
        new Promise((ok) => {
          requestAnimationFrame(() => requestAnimationFrame(ok))
          setTimeout(ok, 500)
        }),
    )
    return (await page.screenshot({ scale: 'css' })).length
  }
  try {
    const conTela = await peso()
    // !important in linea: batte quello del foglio della sonda
    await page.evaluate(() =>
      document.querySelector('canvas[data-sonda-tela]')?.style.setProperty('visibility', 'hidden', 'important'),
    )
    return conTela / (await peso())
  } finally {
    await page.evaluate(() => {
      const c = document.querySelector('canvas[data-sonda-tela]')
      c?.style.removeProperty('visibility')
      c?.removeAttribute('data-sonda-tela')
    })
    await foglio.evaluate((el) => el.remove())
  }
}
