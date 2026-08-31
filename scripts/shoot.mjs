#!/usr/bin/env node
// shoot.mjs — QA visiva deterministica (S6): scrolla il sito sezione per sezione, scatta
// screenshot a 3 breakpoint, raccoglie errori console/richieste fallite.
// Output: qa/shots/<sezione>-<larghezza>.png + qa/shots/report.json (exit 1 se errori).
//
// Uso: npm run qa:shoot            (dev server già attivo su 127.0.0.1:5199, FUORI sandbox)
//      node scripts/shoot.mjs http://127.0.0.1:5199/
// Le sezioni = <main> section[id]. Browser: playwright-core + Chrome for Testing in cache
// (il Chrome dell'utente NON raggiunge i server locali su questa macchina — fatto verificato).
//
// GUARDIA CANVAS VUOTO (ago 2026) — è il modo documentato in cui questo gate mente: headless
// Chrome può non presentare il canvas WebGPU al compositore, e allora lo screenshot RIESCE ma
// il canvas è nero. Il report resta verde e nessuno se ne accorge finché non guarda i PNG.
// Qui si misura: un PNG quasi uniforme comprime a pochissimi byte, quindi sotto una soglia per
// pixel lo scatto viene marcato come sospetto e il gate fallisce. È un'euristica, dichiarata
// come tale — ma cattura esattamente quel fallimento. Con --headed si usa la GPU vera.
import { chromium } from 'playwright-core'
import { mkdirSync, rmSync, writeFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'

// --reduced: stessa passata con `prefers-reduced-motion: reduce`. Il path ridotto è nella
// definizione di «done» del kit ma nessuno lo guardava mai: senza emulazione si verifica solo
// il ramo animato, e i fallback statici marciscono in silenzio.
const REDUCED = process.argv.includes('--reduced')
const url = process.argv.slice(2).find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5199/'
const headed = process.argv.includes('--headed')
// byte di PNG per pixel sotto cui l'immagine è quasi certamente piatta (misurato: uno scatto
// reale di questa scena sta un ordine di grandezza sopra)
const FLAT_BYTES_PER_PX = 0.02
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
      const bytesPerPx = statSync(file).size / (bp.width * bp.height)
      if (bytesPerPx < FLAT_BYTES_PER_PX)
        errors.push(
          `[canvas-vuoto] ${file}: ${bytesPerPx.toFixed(4)} B/px < ${FLAT_BYTES_PER_PX} — immagine quasi piatta. ` +
            `Su WebGPU headless il canvas può non arrivare al compositore: rilancia con --headed.`,
        )
      report.shots.push({ file, bytesPerPx: +bytesPerPx.toFixed(4) })
    }

    report.breakpoints.push({ ...bp, sections, errors })
    report.errors.push(...errors)
    await page.close()
  }
} finally {
  await browser.close()
}

writeFileSync(`${OUT}/${REDUCED ? 'report-reduced' : 'report'}.json`, JSON.stringify(report, null, 2))
console.log(`✓ ${report.shots.length} screenshot in ${OUT}/ · errori: ${report.errors.length}`)
for (const e of report.errors.slice(0, 10)) console.log('  ', e)
if (report.errors.length > 0) process.exitCode = 1
