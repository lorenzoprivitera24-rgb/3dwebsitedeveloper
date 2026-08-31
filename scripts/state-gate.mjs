#!/usr/bin/env node
// state-gate.mjs — il PRIMO dei tre gate del kit, e l'unico deterministico al 100%.
//
// I tre gate, e perché sono tre e non uno:
//   1. STATO   (questo)         numeri del contratto scroll→scena. Nessuna GPU, nessun pixel,
//                               nessun cronometro: o converge o no. Gira headless, zero flake.
//   2. PIXEL   (qa:shoot)       aspetto. Serve una GPU vera e soglie percettive: headless Chrome
//                               non presenta il canvas WebGPU al compositore (scatto nero).
//   3. FRAME   (qa:frames)      tempo per frame. Serve GPU vera + statistica (mediana/p95),
//                               mai confronto esatto.
// Mischiarli produce un gate che fallisce a caso e che nessuno guarda più.
//
// Uso:
//   node scripts/state-gate.mjs [url] [--baseline] [--headed]
//   --baseline  registra lo stato osservato in qa/state-baseline.json (da rifare quando la
//               regia cambia DI PROPOSITO: il diff della baseline è la review della modifica)
//
// Esce 1 se un'invariante o una regola di regia è violata, o se la baseline è cambiata oltre
// tolleranza. Scrive sempre qa/state-report.json.
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'

const args = process.argv.slice(2)
const url = args.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5199/'
const writeBaseline = args.includes('--baseline')
const headed = args.includes('--headed')

const SPEC = JSON.parse(readFileSync('qa/checkpoints.json', 'utf8'))
const BASELINE_PATH = 'qa/state-baseline.json'
// La baseline registra i canali di regia; la tolleranza è larga abbastanza da non inciampare
// sul damping residuo e stretta abbastanza da vedere una regia cambiata.
const BASELINE_PATHS = [
  'sceneTargets.morph',
  'sceneTargets.gradientMix',
  'sceneTargets.camX',
  'sceneTargets.camY',
  'sceneTargets.camZ',
]
const BASELINE_TOL = 0.03

const exe =
  process.env.CHROMIUM_PATH ??
  `${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN)

function check(rule, state) {
  const actual = get(state, rule.path)
  const label = `${rule.path} ${rule.op}${rule.to ? ` ${rule.to}` : ''}`
  const fail = (msg) => ({ ok: false, label, why: rule.why, msg })
  const ok = (msg) => ({ ok: true, label, why: rule.why, msg })

  switch (rule.op) {
    case 'converges': {
      const a = num(actual)
      const t = num(get(state, rule.to))
      if (Number.isNaN(a) || Number.isNaN(t)) return fail(`valore assente (actual=${actual}, target=${get(state, rule.to)})`)
      const d = Math.abs(a - t)
      return d <= rule.tol
        ? ok(`Δ ${d.toFixed(4)} ≤ ${rule.tol}`)
        : fail(`NON converge: ${a.toFixed(4)} vs target ${t.toFixed(4)} (Δ ${d.toFixed(4)} > ${rule.tol})`)
    }
    case 'approx': {
      const a = num(actual)
      const d = Math.abs(a - rule.value)
      return d <= rule.tol ? ok(`Δ ${d.toFixed(4)}`) : fail(`${a} ≠ ${rule.value} (Δ ${d.toFixed(4)} > ${rule.tol})`)
    }
    case 'between': {
      const a = num(actual)
      return a >= rule.min && a <= rule.max ? ok(`${a.toFixed(4)}`) : fail(`${a} fuori da [${rule.min}, ${rule.max}]`)
    }
    case 'lte':
      return num(actual) <= rule.value ? ok(`${actual}`) : fail(`${actual} > ${rule.value}`)
    case 'gte':
      return num(actual) >= rule.value ? ok(`${actual}`) : fail(`${actual} < ${rule.value}`)
    case 'equals':
      return actual === rule.value ? ok(`${actual}`) : fail(`${actual} ≠ ${rule.value}`)
    default:
      return fail(`operatore sconosciuto: ${rule.op}`)
  }
}

const browser = await chromium.launch({
  executablePath: exe,
  headless: !headed,
  args: ['--enable-unsafe-webgpu', '--use-angle=metal'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const consoleErrors = []
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
page.on('pageerror', (e) => consoleErrors.push(`[pageerror] ${e.message}`))

const report = { url, backend: null, checkpoints: [], failures: [], consoleErrors }

try {
  await page.goto(`${url}${url.includes('?') ? '&' : '?'}qa=1`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForFunction(() => window.__qa?.ready === true, null, { timeout: 30000 })

  // snapshot di innesco: le draw call per frame si ricavano dal delta fra due snapshot, quindi
  // il primo checkpoint avrebbe letto il contatore grezzo. Questo lo ancora.
  await page.evaluate(() => window.__qa.state())

  const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : null
  const newBaseline = {}

  for (const cp of SPEC.checkpoints) {
    const moved = await page.evaluate(
      ([id, p]) => window.__qa.scrubToSection(id, p),
      [cp.section, cp.p],
    )
    if (!moved) {
      report.failures.push(`[${cp.name}] sezione "${cp.section}" senza trigger ScrollTrigger`)
      continue
    }
    await page.evaluate((f) => window.__qa.settle(f), SPEC.settleFrames)
    const state = await page.evaluate(() => window.__qa.state())
    report.backend ??= state.backend

    const results = []
    for (const rule of [...SPEC.invariants, ...(cp.expect ?? [])]) {
      const r = check(rule, state)
      results.push(r)
      if (!r.ok) report.failures.push(`[${cp.name}] ${r.label}: ${r.msg}${r.why ? ` — ${r.why}` : ''}`)
    }

    // baseline: registra o confronta i canali di regia
    const snap = {}
    for (const p of BASELINE_PATHS) snap[p] = Number(get(state, p)?.toFixed?.(4) ?? get(state, p))
    newBaseline[cp.name] = snap
    if (!writeBaseline && baseline?.[cp.name]) {
      for (const [p, was] of Object.entries(baseline[cp.name])) {
        const now = snap[p]
        if (Math.abs(now - was) > BASELINE_TOL)
          report.failures.push(
            `[${cp.name}] regia cambiata: ${p} ${was} → ${now} (tol ${BASELINE_TOL}). Se voluto: rilancia con --baseline e committa il diff.`,
          )
      }
    }

    report.checkpoints.push({ ...cp, state, results })
  }

  if (writeBaseline) {
    writeFileSync(BASELINE_PATH, JSON.stringify(newBaseline, null, 2) + '\n')
    console.log(`✓ baseline scritta in ${BASELINE_PATH}`)
  }
} finally {
  await browser.close()
}

mkdirSync('qa', { recursive: true })
writeFileSync('qa/state-report.json', JSON.stringify(report, null, 2) + '\n')

console.log(`\n— backend osservato: ${report.backend ?? 'n/d'}${headed ? '' : ' (headless: il backend reale si misura con qa:frames --headed)'}`)
for (const cp of report.checkpoints) {
  const bad = cp.results.filter((r) => !r.ok).length
  console.log(`${bad ? '✗' : '✓'} ${cp.name.padEnd(24)} ${cp.results.length - bad}/${cp.results.length} ok`)
}
if (consoleErrors.length) console.log(`\n⚠ errori console: ${consoleErrors.length}\n  ${consoleErrors.slice(0, 5).join('\n  ')}`)
if (report.failures.length) {
  console.log(`\n✗ ${report.failures.length} violazioni:`)
  for (const f of report.failures) console.log('  ·', f)
  process.exitCode = 1
} else {
  console.log('\n✓ gate di stato verde')
}
