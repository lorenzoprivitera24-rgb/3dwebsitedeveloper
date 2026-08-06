#!/usr/bin/env node
// shoot.mjs — QA visiva deterministica (S6): scrolla il sito sezione per sezione, scatta
// screenshot a 3 breakpoint, raccoglie errori console/richieste fallite.
// Output: qa/shots/<sezione>-<larghezza>.png + qa/shots/report.json (exit 1 se errori).
//
// Uso: npm run qa:shoot            (dev server già attivo su 127.0.0.1:5199, FUORI sandbox)
//      node scripts/shoot.mjs http://127.0.0.1:5199/
// Le sezioni = <main> section[id]. Browser: playwright-core + Chrome for Testing in cache
// (il Chrome dell'utente NON raggiunge i server locali su questa macchina — fatto verificato).
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'

// --reduced: stessa passata con `prefers-reduced-motion: reduce`. Il path ridotto è nella
// definizione di «done» del kit ma nessuno lo guardava mai: senza emulazione si verifica solo
// il ramo animato, e i fallback statici marciscono in silenzio.
const REDUCED = process.argv.includes('--reduced')
const url = process.argv.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5199/'
const OUT = 'qa/shots'
const BREAKPOINTS = [
  { width: 390, height: 844 },   // mobile
  { width: 834, height: 1194 },  // tablet
  { width: 1440, height: 900 },  // desktop
]
const exe =
  process.env.CHROMIUM_PATH ??
  `${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({
  executablePath: exe,
  headless: true,
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
      await page.waitForTimeout(900)
      const file = `${OUT}/${REDUCED ? 'reduced-' : ''}${id}-${bp.width}.png`
      await page.screenshot({ path: file })
      report.shots.push(file)
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
