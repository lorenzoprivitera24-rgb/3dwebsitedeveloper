#!/usr/bin/env node
// frame-perf.mjs — il TERZO gate: tempo per frame, per percorso, con statistica.
//
// Perché è separato da perf:check — quello misura il PESO (bundle, asset: byte su disco, gate
// deterministico). Questo misura la FLUIDITÀ, che è una grandezza fisica: richiede una GPU vera
// e va letta in mediana/p95, mai in confronto esatto.
//
// Perché gira HEADED di default — headless Chrome non presenta il canvas WebGPU al compositore e
// su macOS spesso non espone affatto WebGPU: si finirebbe a misurare il fallback WebGL2 credendo
// di misurare WebGPU. Il gate dichiara sempre quale percorso ha misurato.
//
// Limite dichiarato: il throttling CPU si emula via CDP (Emulation.setCPUThrottlingRate), la GPU
// no. Un 'profilo mobile' qui è un'approssimazione della sola CPU — la prova su device resta.
//
// Uso: node scripts/frame-perf.mjs [url] [--headless] [--path WebGPU|WebGL2]
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'

const args = process.argv.slice(2)
const url = args.find((a) => a.startsWith('http')) ?? 'http://127.0.0.1:5199/'
const headless = args.includes('--headless')
const forcedPath = args.includes('--path') ? args[args.indexOf('--path') + 1] : undefined

const B = JSON.parse(readFileSync('qa/budget.json', 'utf8'))
const exe =
  process.env.CHROMIUM_PATH ??
  `${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`

const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]

// Il primo frame dopo uno scrub è quasi sempre un outlier (rebuild delle pipeline, upload di
// texture): lo si scarta esplicitamente invece di lasciarlo avvelenare la mediana.
const WARMUP_DROP = 10

const browser = await chromium.launch({
  executablePath: exe,
  headless,
  args: ['--enable-unsafe-webgpu', '--use-angle=metal'],
})

const report = { url, headless, measured: [], failures: [], warnings: [] }

try {
  for (const vp of B.viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
    const cdp = await page.context().newCDPSession(page)
    if (vp.cpuThrottle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: vp.cpuThrottle })

    await page.goto(`${url}${url.includes('?') ? '&' : '?'}qa=1`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForFunction(() => window.__qa?.ready === true, null, { timeout: 30000 })

    await page.evaluate(() => window.__qa.state()) // innesco per le draw call per frame
    const backend = forcedPath ?? (await page.evaluate(() => window.__qa.state().backend))
    const budget = B.paths[backend]
    if (!budget) {
      report.warnings.push(`[${vp.name}] nessun budget per il percorso "${backend}" — misuro senza gate`)
    }

    for (const at of B.at) {
      const moved = await page.evaluate(([id, p]) => window.__qa.scrubToSection(id, p), [at.section, at.p])
      if (!moved) {
        report.failures.push(`[${vp.name}] sezione "${at.section}" senza trigger`)
        continue
      }
      await page.evaluate((f) => window.__qa.settle(f), B.settleFrames)
      const raw = await page.evaluate((n) => window.__qa.frameSamples(n), B.samples + WARMUP_DROP)
      const samples = raw.slice(WARMUP_DROP).sort((a, b) => a - b)
      const state = await page.evaluate(() => window.__qa.state())

      // Il vsync inchioda la mediana a ~16,7 ms su qualunque macchina che ce la faccia: come
      // discriminante è cieca (non distingue "ci arriva col fiato corto" da "gli avanza il
      // triplo"). Il segnale vero è la CODA — la percentuale di frame lunghi, cioè i frame
      // saltati, che è ciò che l'occhio percepisce come scatto.
      const longFrames = samples.filter((ms) => ms > B.longFrameMs).length
      const row = {
        viewport: vp.name,
        cpuThrottle: vp.cpuThrottle,
        backend,
        at: `${at.section}@${at.p}`,
        median: +quantile(samples, 0.5).toFixed(2),
        p95: +quantile(samples, 0.95).toFixed(2),
        longPct: +((100 * longFrames) / samples.length).toFixed(1),
        calls: state.render.calls,
        triangles: state.render.triangles,
        dpr: state.dpr,
      }
      report.measured.push(row)

      if (budget) {
        if (row.median > budget.frameMs.median)
          report.failures.push(`[${vp.name} ${backend} ${row.at}] mediana ${row.median} ms > ${budget.frameMs.median} ms`)
        if (row.p95 > budget.frameMs.p95)
          report.failures.push(`[${vp.name} ${backend} ${row.at}] p95 ${row.p95} ms > ${budget.frameMs.p95} ms`)
        if (row.longPct > budget.maxLongFramePct)
          report.failures.push(
            `[${vp.name} ${backend} ${row.at}] frame lunghi ${row.longPct}% > ${budget.maxLongFramePct}% (>${B.longFrameMs} ms: sono gli scatti che si vedono)`,
          )
        // diagnostica: non fa fallire, spiega
        if (row.calls > budget.diagnostics.calls)
          report.warnings.push(`[${vp.name} ${backend} ${row.at}] draw call ${row.calls} > ${budget.diagnostics.calls} (diagnostica)`)
        if (row.triangles > budget.diagnostics.triangles)
          report.warnings.push(`[${vp.name} ${backend} ${row.at}] triangoli ${row.triangles} > ${budget.diagnostics.triangles} (diagnostica)`)
      }
    }
    await page.close()
  }
} finally {
  await browser.close()
}

mkdirSync('qa', { recursive: true })
writeFileSync('qa/frame-report.json', JSON.stringify(report, null, 2) + '\n')

console.log(`\n(frame lungo = oltre ${B.longFrameMs} ms)`)
console.log('\n| viewport | cpu | percorso | punto | mediana | p95 | lunghi | calls | tris |')
console.log('|---|---|---|---|---|---|---|---|---|')
for (const r of report.measured)
  console.log(
    `| ${r.viewport} | ${r.cpuThrottle}× | ${r.backend} | ${r.at} | ${r.median} ms | ${r.p95} ms | ${r.longPct}% | ${r.calls} | ${r.triangles} |`,
  )

for (const w of report.warnings) console.log('⚠', w)
if (report.failures.length) {
  console.log(`\n✗ ${report.failures.length} sforamenti di budget:`)
  for (const f of report.failures) console.log('  ·', f)
  process.exitCode = 1
} else {
  console.log('\n✓ gate frame verde')
}
