#!/usr/bin/env node
// verify-preview.mjs — "a green build is not proof": loads the running dev/preview server in a
// real Chromium, captures console + screenshot, and reports which renderer backend actually ran
// (Stage.tsx logs `[kit] renderer backend: WebGPU|WebGL2` from backend.isWebGPUBackend).
//
// Usage:
//   node scripts/verify-preview.mjs [url] [screenshot.png]
//   env: CHROMIUM_PATH (defaults to Playwright's cached Chrome for Testing)
//        HEADED=1      (headed window — on macOS headless often lacks WebGPU; headed = real GPU)
// Embryo of the future shoot.mjs (per-section × breakpoint QA loop).
import { chromium } from 'playwright-core'
import { homedir } from 'node:os'

const url = process.argv[2] ?? 'http://127.0.0.1:5199/'
const shot = `verify-preview${new URL(url).search ? '-' + new URL(url).search.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') : ''}.png`
const exe =
  process.env.CHROMIUM_PATH ??
  `${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`

const browser = await chromium.launch({
  executablePath: exe,
  headless: !process.env.HEADED,
  args: ['--enable-unsafe-webgpu', '--use-angle=metal'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const logs = []
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
page.on('requestfailed', (r) => logs.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText ?? ''}`))

await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(4500) // let renderer init + HDRI/PMREM settle
await page.screenshot({ path: shot })
await browser.close()

const backend = logs.find((l) => l.includes('renderer backend'))
const errors = logs.filter((l) => /^\[(error|pageerror|requestfailed)\]/.test(l))
console.log(logs.join('\n'))
console.log(`\n— backend: ${backend ?? 'NON LOGGATO (renderer non partito?)'}`)
console.log(`— errori: ${errors.length}`)
console.log(`— screenshot: ${shot}`)
if (errors.length > 0 || !backend) process.exitCode = 1
