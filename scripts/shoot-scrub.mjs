#!/usr/bin/env node
// shoot-scrub.mjs — QA visiva delle sezioni PINNATE, il buco che shoot.mjs lascia aperto.
//
// `qa:shoot` scrolla a ogni sezione e scatta: per una sezione normale è giusto, per una sezione
// pinnata scatta sempre lo **stato A** — la pila ancora chiusa, il testo ancora fermo. Una
// coreografia scrubbata si giudica sui fotogrammi DENTRO il pin, cioè su una manciata di scatti
// distribuiti lungo la corsa. Senza questo, il giro di QA certifica come buona un'animazione che
// nessuno ha visto muoversi.
//
// Uso: npm run qa:scrub -- <sezione> [fotogrammi] [larghezza] [altezza]
//      node scripts/shoot-scrub.mjs explode 6 1440 900
// Output: qa/shots/scrub-<sezione>-<larghezza>-NN.png (+ errori console, exit 1)
// Richiede il dev server attivo su 127.0.0.1:5199, come shoot.mjs.
import { chromium } from 'playwright-core'
import { homedir } from 'node:os'
import { mkdirSync } from 'node:fs'

const [, , sectionId, framesArg = '6', wArg = '1440', hArg = '900', urlArg] = process.argv
if (!sectionId) {
  console.error('uso: node scripts/shoot-scrub.mjs <sezione> [fotogrammi] [larghezza] [altezza]')
  process.exit(1)
}
const frames = parseInt(framesArg, 10)
const viewport = { width: parseInt(wArg, 10), height: parseInt(hArg, 10) }
const url = urlArg ?? 'http://127.0.0.1:5199/'
const OUT = 'qa/shots'
mkdirSync(OUT, { recursive: true })

const exe =
  process.env.CHROMIUM_PATH ??
  `${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`

const browser = await chromium.launch({
  executablePath: exe,
  headless: !process.env.HEADED,
  args: ['--enable-unsafe-webgpu', '--use-angle=metal'],
})
const page = await browser.newPage({ viewport })
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(`[console] ${m.text()}`))
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))
page.on('requestfailed', (r) =>
  errors.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText ?? ''}`),
)

await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(4000) // renderer + IBL/PMREM + primo refresh di ScrollTrigger

// La corsa del pin NON è l'altezza della sezione: ScrollTrigger avvolge la sezione in un
// `.pin-spacer` alto quanto `end`. Misurare la sezione porta a scattare sei volte lo stesso
// fotogramma.
const range = await page.evaluate((id) => {
  const el = document.getElementById(id)
  if (!el) return null
  const spacer = el.closest('.pin-spacer') ?? el
  return {
    top: spacer.getBoundingClientRect().top + window.scrollY,
    height: spacer.offsetHeight,
    vh: window.innerHeight,
    pinned: spacer !== el,
  }
}, sectionId)

if (!range) {
  console.error(`sezione #${sectionId} non trovata nel DOM`)
  await browser.close()
  process.exit(1)
}
if (!range.pinned) {
  console.warn(`⚠︎  #${sectionId} non è pinnata (nessun .pin-spacer): scatto sulla sua altezza`)
}
console.log(
  `#${sectionId} @${viewport.width}×${viewport.height}: corsa ${range.height}px da y=${Math.round(range.top)}`,
)

const travel = Math.max(0, range.height - range.vh)
for (let i = 0; i < frames; i++) {
  const t = frames === 1 ? 0 : i / (frames - 1)
  await page.evaluate((v) => window.scrollTo(0, v), range.top + travel * t)
  await page.waitForTimeout(700) // scrub + damping della scena si assestano
  const file = `${OUT}/scrub-${sectionId}-${viewport.width}-${String(i).padStart(2, '0')}.png`
  await page.screenshot({ path: file })
  console.log(`· t=${t.toFixed(2)} → ${file}`)
}

await browser.close()
console.log(errors.length ? `\n⚠︎ ${errors.length} errori:\n${errors.join('\n')}` : '\n✓ 0 errori')
if (errors.length) process.exitCode = 1
