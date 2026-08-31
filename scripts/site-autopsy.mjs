#!/usr/bin/env node
// site-autopsy.mjs — S0c della fabbrica: «autopsia di un sito vecchio» per la modalità redesign
// (sito esistente + prompt → sito 3D nuovo). Ispeziona il sito live e produce DUE artefatti:
//   brief/legacy-audit.md    → referto leggibile in italiano: mappa dell'informazione, inventario
//                              contenuti riusabili, stack rilevato, design token estratti dai
//                              computed styles reali, asset brand, baseline performance e la
//                              PROPOSTA «Tieni / Butta / Reinventa» per il gate umano S0.
//   brief/legacy-tokens.json → token machine-readable per il creative-director (S1): «vincoli di
//                              brand ereditati» — da leggere come input, NON applicati in automatico.
//
// Uso: node scripts/site-autopsy.mjs <url> [--out brief/]
//      env: CHROMIUM_PATH (default: Chrome for Testing già in cache Playwright — NON scarica browser)
//
// Due passate playwright-core (1440×900 per i computed styles + 390×844 per il check responsive)
// più un fingerprint statico via fetch con le firme di scripts/recon-fingerprint.mjs (replicate:
// tenerle allineate). Regge timeout e siti senza JS; se il browser non parte, produce comunque il
// referto dalla sola passata statica (con nota).
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

// ── CLI ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const url = args.find((a) => !a.startsWith('--'))
const outIdx = args.indexOf('--out')
const OUT = outIdx !== -1 && args[outIdx + 1] ? args[outIdx + 1] : 'brief'
if (!url || !/^https?:\/\//.test(url)) {
  console.error('Uso: node scripts/site-autopsy.mjs <url> [--out brief/]')
  process.exit(1)
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const exe =
  process.env.CHROMIUM_PATH ??
  `${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`

// ── Firme stack (replicate da scripts/recon-fingerprint.mjs + firme "legacy" per il redesign) ──
const SIGS = [
  ['framework: next.js', /__NEXT_DATA__|\/_next\/static|self\.__next_f/],
  ['framework: nuxt', /__NUXT__|\/_nuxt\//],
  ['framework: astro', /astro-island|\/_astro\//],
  ['framework: sveltekit', /__sveltekit|data-sveltekit/],
  ['framework: remix', /__remixContext/],
  ['framework: framer-sites', /framerusercontent\.com|data-framer-hydrate|__framer_events|framer\/appear/],
  ['framework: webflow', /data-wf-page|website-files\.com/],
  ['framework: wordpress', /wp-content\/|wp-includes\//],
  ['lib: react', /react-dom|\$RC=|__next_f|createRoot\(|react\.production/],
  ['lib: vue', /__vue|vue\.runtime|createApp\(/],
  ['motion: gsap', /gsap|GreenSock|_gsScope/],
  ['motion: ScrollTrigger', /ScrollTrigger/],
  ['motion: lenis', /lenis|Lenis/],
  ['motion: locomotive-scroll', /locomotive/i],
  ['motion: framer-motion / motion', /framer-motion|motion\/react|motion-dom|popmotion|LazyMotion/],
  ['motion: anime.js', /animejs|createTimeline\(|createScope\(|onScroll\(/],
  ['motion: split-type', /split-type|SplitType/],
  ['3d: three.js', /three\.module|three\.webgpu|WebGLRenderer|isMesh|BufferGeometry/],
  ['3d: webgpu', /WebGPURenderer|navigator\.gpu|isWebGPURenderer|GPUShaderStage/],
  ['3d: tsl / node materials', /three\/tsl|NodeMaterial|colorNode|positionNode|MaterialX/],
  ['3d: react-three-fiber', /@react-three|react-three-fiber|useFrame\(|useThree\(/],
  ['3d: ogl', /["']ogl["']|OGLRenderingContext|from"ogl"/],
  ['3d: pixi.js', /pixi\.js|PIXI\./],
  ['3d: spline', /splinetool|spline\.design/],
  ['asset: glb/gltf', /\.glb\b|\.gltf\b|GLTFLoader/],
  ['asset: ktx2/basis', /\.ktx2|KTX2Loader|basis_transcoder/],
  ['asset: hdr/exr', /\.hdr\b|\.exr\b|RGBELoader|EXRLoader/],
  ['shader: glsl inline', /precision highp float|uniform\s+vec[234]|varying\s+vec|fragmentShader|vertexShader|#include <common>/],
  ['transition: View Transitions API', /startViewTransition/],
  ['transition: barba.js', /barba\.js|@barba\/core|barbaWrapper/],
  ['a11y: prefers-reduced-motion gestito', /prefers-reduced-motion/],
  ['font: fontshare/pangram/typekit', /fontshare|pangram|typekit|use\.typekit/],
  // firme "legacy" (utili solo in autopsia: indizi di stack/estetica datata)
  ['legacy: jquery', /jquery|jQuery\.fn/i],
  ['legacy: bootstrap', /bootstrap(?:\.min)?\.(?:css|js)|data-bs-toggle/i],
  ['legacy: font-awesome', /font-?awesome|fa-solid|fa-brands/i],
  ['legacy: slick/owl carousel', /slick-carousel|slick\.min|owl\.carousel/i],
  ['legacy: wix', /wix\.com|wixstatic\.com/],
  ['legacy: squarespace', /squarespace/i],
  ['legacy: joomla/drupal', /\/media\/jui\/|joomla|drupal/i],
]
const VERSION_RES = [
  ['gsap', /version:"(3\.[0-9]+\.[0-9]+)"/],
  ['three REVISION', /REVISION\s*=\s*["']([0-9]+[a-z]*)["']/],
  ['lenis', /version\s*[:=]\s*["']([0-9]+\.[0-9]+\.[0-9]+)["']/],
  ['jquery', /jquery[/-]v?([0-9]+\.[0-9]+\.[0-9]+)/i],
]

// ── Passata statica: fetch HTML + JS/CSS di primo livello, firme regex ───────
async function get(u, max = 2 * 1024 * 1024) {
  try {
    const res = await fetch(u, {
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
      redirect: 'follow',
      signal: AbortSignal.timeout(25000),
    })
    const buf = Buffer.from(await res.arrayBuffer())
    return { ok: res.ok, status: res.status, url: res.url, text: buf.subarray(0, max).toString('utf8'), bytes: buf.length }
  } catch (e) {
    return { ok: false, status: 0, url: u, text: '', bytes: 0, error: String(e && e.cause ? e.cause : e) }
  }
}
const absUrl = (base, u) => { try { return new URL(u, base).href } catch { return null } }

async function staticFingerprint(site) {
  const page = await get(site)
  const out = { finalUrl: page.url, status: page.status, error: page.error ?? null, htmlBytes: page.bytes, jsWeightBytes: 0, filesScanned: 0, hits: {}, versions: {} }
  if (!page.text) return out
  const html = page.text
  const scriptSrcs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map((m) => m[1])
  const preloads = [...html.matchAll(/<link[^>]+rel=["'](?:modulepreload|preload)["'][^>]*href=["']([^"']+\.m?js[^"']*)["']/g)].map((m) => m[1])
  const cssHrefs = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/g)].map((m) => m[1])
  const jsUrls = [...new Set([...scriptSrcs, ...preloads].map((u) => absUrl(page.url, u)).filter(Boolean))].slice(0, 12)
  const cssUrls = [...new Set(cssHrefs.map((u) => absUrl(page.url, u)).filter(Boolean))].slice(0, 4)
  const fetched = await Promise.all([...jsUrls, ...cssUrls].map(async (u) => ({ name: u, ...(await get(u)) })))
  const corpus = [{ name: '(html)', text: html, bytes: html.length }, ...fetched.filter((f) => f.text && f.status === 200)]
  out.filesScanned = corpus.length
  out.jsWeightBytes = corpus.filter((c) => jsUrls.includes(c.name)).reduce((s, c) => s + (c.bytes || 0), 0)
  for (const { text } of corpus) {
    for (const [label, re] of SIGS) if (re.test(text)) out.hits[label] = true
    for (const [vl, re] of VERSION_RES) { const m = text.match(re); if (m && !out.versions[vl]) out.versions[vl] = m[1] }
  }
  out.hits = Object.keys(out.hits)
  return out
}

// ── Passata browser: computed styles reali, IA, contenuti, rete ──────────────
async function gotoSafe(page, u) {
  try { await page.goto(u, { waitUntil: 'networkidle', timeout: 30000 }); return 'networkidle' }
  catch { /* siti con long-polling/analytics non raggiungono mai networkidle */ }
  try { await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 20000 }); return 'domcontentloaded' }
  catch { return null }
}

// Eseguita NEL browser: raccoglie meta, nav, outline, copy, immagini, computed styles.
function harvestInPage() {
  const clean = (t) => (t || '').trim().replace(/\s+/g, ' ')
  const abs = (u) => { try { return new URL(u, location.href).href } catch { return u || null } }
  const ownText = (el) => {
    let t = ''
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.textContent
    return clean(t)
  }
  const meta = {
    title: document.title || null,
    description: document.querySelector('meta[name="description"]')?.content ?? null,
    generator: document.querySelector('meta[name="generator"]')?.content ?? null,
    lang: document.documentElement.lang || null,
    ogImage: abs(document.querySelector('meta[property="og:image"]')?.content) || null,
    favicon: document.querySelector('link[rel~="icon"]')?.href || document.querySelector('link[rel="apple-touch-icon"]')?.href || abs('/favicon.ico'),
    viewportMeta: !!document.querySelector('meta[name="viewport"]'),
    hasCanvas: !!document.querySelector('canvas'),
  }
  const nav = []
  const seenNav = new Set()
  for (const a of document.querySelectorAll('header a, nav a')) {
    const text = clean(a.textContent)
    if (!text || text.length > 40) continue
    const key = text.toLowerCase()
    if (seenNav.has(key)) continue
    seenNav.add(key)
    nav.push({ text, href: a.getAttribute('href') })
    if (nav.length >= 25) break
  }
  const outline = []
  for (const h of document.querySelectorAll('h1, h2, h3')) {
    const text = clean(h.textContent)
    if (text) outline.push({ tag: h.tagName.toLowerCase(), text: text.slice(0, 120) })
    if (outline.length >= 60) break
  }
  const copyBlocks = []
  for (const p of document.querySelectorAll('p, blockquote')) {
    const text = clean(p.textContent)
    if (text.length < 80) continue
    copyBlocks.push({ text: text.slice(0, 500), chars: text.length })
    if (copyBlocks.length >= 15) break
  }
  const images = []
  const seenImg = new Set()
  for (const img of document.querySelectorAll('img')) {
    const src = img.currentSrc || img.src
    if (!src || src.startsWith('data:') || seenImg.has(src)) continue
    seenImg.add(src)
    images.push({ src, alt: img.alt || '', w: img.naturalWidth, h: img.naturalHeight })
    if (images.length >= 30) break
  }
  const docLinks = []
  for (const a of document.querySelectorAll('a[href]')) {
    if (!/\.(pdf|docx?|pptx?|xlsx?|odt|zip)([?#]|$)/i.test(a.href)) continue
    docLinks.push({ text: clean(a.textContent).slice(0, 80), href: a.href })
    if (docLinks.length >= 20) break
  }
  let logo = null
  for (const img of document.querySelectorAll('img, svg')) {
    const hay = `${img.getAttribute('src') || ''} ${img.getAttribute('alt') || ''} ${img.getAttribute('class') || ''} ${img.id || ''} ${img.getAttribute('aria-label') || ''}`.toLowerCase()
    if (hay.includes('logo')) { logo = img.tagName === 'IMG' ? (img.currentSrc || img.src) : '(svg inline in ' + (img.closest('header') ? 'header' : 'pagina') + ')'; break }
  }
  if (!logo) { const hi = document.querySelector('header img, a[href="/"] img'); if (hi) logo = hi.currentSrc || hi.src }

  // computed styles: pesa i background per area, i colori testo per lunghezza del testo
  const bg = {}, txt = {}, accent = {}, fonts = {}, spacing = {}, radius = {}
  const sizes = { h1: {}, h2: {}, h3: {}, body: {} }
  let n = 0
  for (const el of document.querySelectorAll('body *')) {
    if (++n > 5000) break
    const s = getComputedStyle(el)
    if (s.display === 'none' || s.visibility === 'hidden') continue
    const r = el.getBoundingClientRect()
    const area = Math.max(0, r.width) * Math.max(0, r.height)
    const tag = el.tagName.toLowerCase()
    if (area > 400 && s.backgroundColor && !/rgba?\(\s*\d+[,\s]+\d+[,\s]+\d+[,\s/]+0\s*\)/.test(s.backgroundColor) && s.backgroundColor !== 'transparent') {
      const b = (bg[s.backgroundColor] ||= { area: 0, count: 0 }); b.area += area; b.count++
    }
    const t = ownText(el)
    if (t.length > 0) {
      const c = (txt[s.color] ||= { len: 0, count: 0 }); c.len += t.length; c.count++
      const fam = (s.fontFamily || '').split(',')[0].trim().replace(/^["']|["']$/g, '')
      if (fam) {
        const f = (fonts[fam] ||= { weights: {}, heading: 0, body: 0, len: 0 })
        f.weights[s.fontWeight] = (f.weights[s.fontWeight] || 0) + 1
        f[/^h[1-6]$/.test(tag) ? 'heading' : 'body']++
        f.len += t.length
      }
      if (tag === 'h1' || tag === 'h2' || tag === 'h3') sizes[tag][s.fontSize] = (sizes[tag][s.fontSize] || 0) + 1
      // body pesato per lunghezza del testo: i micro-<p> del footer non devono definire la scala
      if (tag === 'p' || tag === 'li') sizes.body[s.fontSize] = (sizes.body[s.fontSize] || 0) + t.length
    }
    if (tag === 'a' || tag === 'button' || el.getAttribute('role') === 'button' || (tag === 'input' && el.type === 'submit')) {
      for (const c of [s.color, s.backgroundColor]) if (c && c !== 'transparent') accent[c] = (accent[c] || 0) + 1
    }
    if (area > 50000 && ['section', 'header', 'footer', 'main', 'article', 'div'].includes(tag)) {
      for (const v of [s.paddingTop, s.paddingBottom, s.marginTop, s.marginBottom]) {
        const px = Math.round(parseFloat(v))
        if (px >= 8 && px <= 240) spacing[px] = (spacing[px] || 0) + 1
      }
    }
    const br = Math.round(parseFloat(s.borderTopLeftRadius))
    if (br > 0 && br <= 80 && area > 400) radius[br] = (radius[br] || 0) + 1
  }
  return { meta, nav, outline, copyBlocks, images, docLinks, logo, bg, txt, accent, fonts, sizes, spacing, radius, bodyBg: getComputedStyle(document.body).backgroundColor }
}

async function browserPass(site) {
  let browser
  try {
    browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] })
  } catch (e) {
    return { error: 'browser non avviato: ' + e.message }
  }
  try {
    // desktop 1440×900: computed styles + rete
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, userAgent: UA })
    const net = { totale: 0, byType: {} }
    page.on('response', (r) => {
      net.totale++
      const type = r.request().resourceType()
      const bytes = Number(r.headers()['content-length'] || 0)
      const t = (net.byType[type] ||= { n: 0, bytes: 0 }); t.n++; t.bytes += bytes
    })
    const loaded = await gotoSafe(page, site)
    if (!loaded) return { error: 'pagina non caricata (timeout) a 1440px' }
    await page.waitForTimeout(2500) // lascia assestare font, lazy-load e animazioni di ingresso
    const harvest = await page.evaluate(harvestInPage)
    await page.close()

    // mobile 390×844: solo verifica responsive (overflow orizzontale)
    let mobile = { checked: false }
    const mp = await browser.newPage({ viewport: { width: 390, height: 844 }, userAgent: UA })
    if (await gotoSafe(mp, site)) {
      await mp.waitForTimeout(1200)
      mobile = await mp.evaluate(() => ({
        checked: true,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 5,
      }))
    }
    await mp.close()
    return { harvest, net, mobile, loaded }
  } catch (e) {
    return { error: 'passata browser fallita: ' + e.message }
  } finally {
    await browser.close()
  }
}

// ── Sintesi in Node: palette, font, scala, euristiche ────────────────────────
function toHex(c) {
  const m = (c || '').match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)/)
  if (!m) return null
  if (m[4] !== undefined && parseFloat(m[4]) < 0.5) return null
  const h = (x) => (+x).toString(16).padStart(2, '0')
  return `#${h(m[1])}${h(m[2])}${h(m[3])}`
}

function buildPalette(h) {
  const palette = new Map() // hex → { ruolo, frequenza }
  const put = (hex, ruolo, frequenza) => {
    if (!hex) return
    const cur = palette.get(hex)
    if (cur) cur.frequenza += frequenza
    else palette.set(hex, { hex, ruolo, frequenza })
  }
  // 1. background (pesati per area, il body per primo), 2. testo (per lunghezza), 3. accent
  const bodyHex = toHex(h.bodyBg)
  if (bodyHex) put(bodyHex, 'background', h.bg[h.bodyBg]?.count ?? 1)
  for (const [c, v] of Object.entries(h.bg).sort((a, b) => b[1].area - a[1].area).slice(0, 4)) put(toHex(c), 'background', v.count)
  for (const [c, v] of Object.entries(h.txt).sort((a, b) => b[1].len - a[1].len).slice(0, 3)) put(toHex(c), 'testo', v.count)
  for (const [c, n] of Object.entries(h.accent).sort((a, b) => b[1] - a[1]).slice(0, 4)) put(toHex(c), 'accent', n)
  return [...palette.values()].sort((a, b) => b.frequenza - a.frequenza).slice(0, 10)
}

function buildFonts(h) {
  return Object.entries(h.fonts)
    .sort((a, b) => b[1].len - a[1].len)
    .slice(0, 5)
    .map(([family, f]) => ({
      family,
      weights: Object.keys(f.weights).map(Number).filter((n) => !isNaN(n)).sort((a, b) => a - b),
      ruolo: f.heading > 0 && f.body > 0 ? 'display+body' : f.heading > 0 ? 'display' : 'body',
    }))
}

const topKey = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
// per gli heading vale la taglia display MASSIMA osservata (gli h2/h3 riusati nel footer non definiscono la scala)
const maxPx = (obj) => Object.keys(obj).sort((a, b) => parseFloat(b) - parseFloat(a))[0] ?? null
const topN = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ v: +k, n: v }))

const STOP = new Set(('della delle degli dello dell nella nelle negli questo questa questi queste sono come anche più dove quando essere hanno viene vengono tutti tutte ogni loro nostro nostra nostri nostre vostro perché grazie presso attraverso ancora prima dopo circa about their which where there these those after before because through during would could should with from that this have been will your they what when were other into more only also such than then them some over most each many made make like just').split(' '))
function keywords(text) {
  const freq = {}
  for (const w of text.toLowerCase().split(/[^\p{L}]+/u)) {
    if (w.length < 5 || STOP.has(w)) continue
    freq[w] = (freq[w] || 0) + 1
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([w]) => w)
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log(`⚕ autopsia di ${url} …`)
const [fp, bp] = await Promise.all([staticFingerprint(url), browserPass(url)])
if (fp.error && bp.error) {
  console.error(`✗ sito irraggiungibile: statico → ${fp.error} · browser → ${bp.error}`)
  process.exit(1)
}

const note = []
if (bp.error) note.push(`passata browser fallita (${bp.error}): design token e outline NON disponibili, referto solo statico`)
if (fp.error) note.push(`fetch statico fallito (${fp.error}): fingerprint stack limitato a ciò che vede il browser`)
if (bp.loaded === 'domcontentloaded') note.push('la pagina non ha mai raggiunto networkidle (long-polling/analytics?): dati raccolti dopo domcontentloaded')

const h = bp.harvest ?? null
const palette = h ? buildPalette(h) : []
const fonts = h ? buildFonts(h) : []
const typeScale = h ? { h1: maxPx(h.sizes.h1), h2: maxPx(h.sizes.h2), h3: maxPx(h.sizes.h3), body: topKey(h.sizes.body) } : {}
const spacing = h ? topN(h.spacing, 6).map((s) => s.v) : []
const radius = h ? topN(h.radius, 4).map((s) => s.v) : []
const stack = fp.hits ?? []
const responsive = bp.mobile?.checked ? !!h?.meta.viewportMeta && !bp.mobile.overflowX : null
if (bp.mobile?.checked && bp.mobile.overflowX) note.push(`overflow orizzontale a 390px (scrollWidth ${bp.mobile.scrollWidth}px): il sito NON è pienamente responsive`)
if (h && !h.meta.viewportMeta) note.push('manca <meta name="viewport">: layout mobile non gestito')

// ── Euristiche Tieni / Butta / Reinventa (PROPOSTA per il gate S0) ───────────
const tieni = [], butta = [], reinventa = []
if (h) {
  if (h.nav.length >= 2 && h.nav.length <= 10) tieni.push(`architettura di navigazione chiara (${h.nav.length} voci): riusala come spina dorsale delle sezioni`)
  const sostanziosi = h.copyBlocks.filter((b) => b.chars >= 200).length
  if (sostanziosi >= 2) tieni.push(`${sostanziosi} blocchi di copy sostanziosi: contenuto reale da riportare in content/*.json (S3)`)
  const conAlt = h.images.filter((i) => i.alt).length
  if (h.images.length && conAlt >= h.images.length / 2) tieni.push(`${conAlt}/${h.images.length} immagini già dotate di alt: inventario fotografico riusabile`)
  if (h.docLinks.length) tieni.push(`${h.docLinks.length} documenti collegati (PDF/DOC): da conservare e rilinkare`)
  if (h.logo) tieni.push('logo esistente: àncora di riconoscibilità del brand')
}
const legacyHits = stack.filter((s) => s.startsWith('legacy:') || s === 'framework: wordpress')
if (legacyHits.length) butta.push(`stack datato: ${legacyHits.join(', ')} → sostituire con lo stack del kit (R3F v9 + WebGPU/TSL + Lenis/GSAP)`)
if (responsive === false) butta.push('layout non responsive a 390px: da rifare mobile-first')
const sysFonts = new Set(['arial', 'helvetica', 'helvetica neue', 'times new roman', 'georgia', 'verdana', 'system-ui', '-apple-system', 'segoe ui', 'sans-serif', 'serif'])
if (fonts.length && fonts.every((f) => sysFonts.has(f.family.toLowerCase()))) butta.push('tipografia solo di sistema, senza identità: scegliere display+body da lib/fonts/ (self-host)')
if (palette.length && !palette.some((p) => p.ruolo === 'accent')) butta.push('palette senza colore accento riconoscibile: definirne uno in S1')
if (h) reinventa.push(`hero: «${h.outline.find((o) => o.tag === 'h1')?.text ?? h.meta.title ?? '(senza h1)'}» → rifarlo come scena 3D scroll-driven (registro /registry)`)
const hasMotion = stack.some((s) => s.startsWith('motion:') || s.startsWith('3d:'))
if (!hasMotion) reinventa.push('nessun motion system rilevato (sito statico): introdurre la scroll choreography Lenis+GSAP e la scena WebGPU con fallback')
else reinventa.push('motion esistente da NON portare così com\'è: ricoreografare su un solo loop (Lenis + gsap.ticker)')
const h1px = parseFloat(typeScale.h1), bodypx = parseFloat(typeScale.body)
if (h1px && bodypx && h1px / bodypx < 2) reinventa.push(`scala tipografica poco contrastata (h1 ${typeScale.h1} vs body ${typeScale.body}): nuova scala display con clamp()`)

// ── Artefatto 1: brief/legacy-audit.md ───────────────────────────────────────
const fmtKB = (b) => (b / 1024).toFixed(0) + ' KB'
const L = []
L.push(`# Autopsia sito esistente — ${h?.meta.title ?? url}`)
L.push('')
L.push(`- **URL**: ${fp.finalUrl ?? url} (HTTP ${fp.status || 'n/d'})`)
L.push(`- **Generato**: ${new Date().toISOString()} da \`scripts/site-autopsy.mjs\` (S0c, modalità redesign)`)
if (h?.meta.description) L.push(`- **Meta description**: ${h.meta.description}`)
if (h?.meta.generator || fp.versions?.jquery) L.push(`- **Generator**: ${h?.meta.generator ?? '—'}`)
if (h?.meta.lang) L.push(`- **Lingua dichiarata**: ${h.meta.lang}`)
if (responsive !== null) L.push(`- **Responsive a 390px**: ${responsive ? 'sì' : '**NO** (vedi note)'}`)
if (h?.meta.hasCanvas) L.push('- **Canvas presente**: sì (c\'è già un layer grafico/3D)')
if (note.length) { L.push('', '> **Note di raccolta**:', ...note.map((n) => `> - ${n}`)) }
L.push('')
if (h) {
  L.push('## Mappa dell\'informazione (home)', '')
  L.push('### Navigazione', '')
  L.push(...(h.nav.length ? h.nav.map((n) => `- [${n.text}](${n.href})`) : ['- (nessun link in header/nav trovato)']))
  L.push('', '### Outline h1–h3', '')
  L.push(...(h.outline.length ? h.outline.map((o) => `${'  '.repeat(+o.tag[1] - 1)}- **${o.tag}** ${o.text}`) : ['- (nessun heading trovato)']))
  L.push('')
  L.push('## Inventario contenuti riusabili', '')
  L.push(`### Blocchi di copy (${h.copyBlocks.length}, ≥80 caratteri)`, '')
  for (const b of h.copyBlocks) L.push(`- *(${b.chars} char · chiavi: ${keywords(b.text).join(', ') || '—'})* ${b.text.slice(0, 180)}${b.text.length > 180 ? '…' : ''}`)
  if (!h.copyBlocks.length) L.push('- (nessun blocco di testo sostanzioso)')
  L.push('', `### Immagini (${h.images.length})`, '')
  for (const i of h.images.slice(0, 20)) L.push(`- \`${i.src}\`${i.alt ? ` — alt: «${i.alt}»` : ' — **senza alt**'}${i.w ? ` (${i.w}×${i.h})` : ''}`)
  if (!h.images.length) L.push('- (nessuna immagine)')
  if (h.docLinks.length) {
    L.push('', `### Documenti collegati (${h.docLinks.length})`, '')
    for (const d of h.docLinks) L.push(`- [${d.text || '(senza testo)'}](${d.href})`)
  }
  L.push('')
}
L.push('## Stack rilevato (firme statiche)', '')
L.push(...(stack.length ? stack.map((s) => `- ${s}`) : ['- (nessuna firma riconosciuta: probabile HTML statico artigianale)']))
if (Object.keys(fp.versions ?? {}).length) L.push('', `Versioni: ${Object.entries(fp.versions).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
L.push('')
if (h) {
  L.push('## Design token estratti (computed styles reali a 1440px)', '')
  L.push('### Palette', '')
  L.push('| Hex | Ruolo | Frequenza (elementi) |', '| --- | --- | --- |')
  for (const p of palette) L.push(`| \`${p.hex}\` | ${p.ruolo} | ${p.frequenza} |`)
  L.push('', '### Font effettivamente renderizzati', '')
  for (const f of fonts) L.push(`- **${f.family}** — pesi ${f.weights.join('/') || 'n/d'} — ruolo ${f.ruolo}`)
  L.push('', '### Scala tipografica', '')
  L.push(`- h1 ${typeScale.h1 ?? 'n/d'} · h2 ${typeScale.h2 ?? 'n/d'} · h3 ${typeScale.h3 ?? 'n/d'} · body ${typeScale.body ?? 'n/d'}`)
  L.push('', `### Spacing ricorrenti: ${spacing.length ? spacing.map((s) => s + 'px').join(', ') : 'n/d'}`)
  L.push(`### Border-radius ricorrenti: ${radius.length ? radius.map((r) => r + 'px').join(', ') : 'nessuno (angoli vivi)'}`)
  L.push('')
  L.push('## Asset brand', '')
  L.push(`- Logo: ${h.logo ? `\`${h.logo}\`` : '(non trovato)'}`)
  L.push(`- Favicon: ${h.meta.favicon ? `\`${h.meta.favicon}\`` : '(non trovata)'}`)
  L.push(`- og:image: ${h.meta.ogImage ? `\`${h.meta.ogImage}\`` : '(non presente)'}`)
  L.push('')
}
L.push('## Performance baseline (sintetica)', '')
L.push(`- Peso HTML: ${fmtKB(fp.htmlBytes || 0)} · JS primo livello scaricato: ${fmtKB(fp.jsWeightBytes || 0)} (${fp.filesScanned || 0} file scansionati)`)
if (bp.net) {
  const t = bp.net.byType
  const row = (k, label) => t[k] ? `${label} ${t[k].n} richieste${t[k].bytes ? ` (~${fmtKB(t[k].bytes)})` : ''}` : null
  L.push(`- Rete (playwright, 1440px): ${bp.net.totale} richieste totali — ${['script', 'stylesheet', 'image', 'font', 'media'].map((k) => row(k, { script: 'JS', stylesheet: 'CSS', image: 'IMG', font: 'FONT', media: 'MEDIA' }[k])).filter(Boolean).join(' · ') || 'dettaglio non disponibile'}`)
  L.push('  (byte da header content-length: le risposte senza header non sono conteggiate)')
}
L.push('')
L.push('## Tieni / Butta / Reinventa — **PROPOSTA per il gate umano S0**', '')
L.push('> Euristiche automatiche, **da validare con il cliente prima di S1**: niente di questo blocco è applicato in automatico.', '')
L.push('### Tieni (contenuti e IA che funzionano)', '')
L.push(...(tieni.length ? tieni.map((s) => `- ${s}`) : ['- (nulla di evidente da tenere: verificare a mano)']))
L.push('', '### Butta (stack/estetica datata)', '')
L.push(...(butta.length ? butta.map((s) => `- ${s}`) : ['- (nessun segnale forte di obsolescenza: la base è sana)']))
L.push('', '### Reinventa (hero, motion)', '')
L.push(...reinventa.map((s) => `- ${s}`))
L.push('')
L.push('---')
L.push('*I token estratti sono in `legacy-tokens.json`: il creative-director (S1) li legge come **vincoli di brand ereditati**, non come tema da riapplicare.*')
L.push('')

// ── Artefatto 2: brief/legacy-tokens.json ────────────────────────────────────
const tokensJson = {
  fonte: fp.finalUrl ?? url,
  generatoIl: new Date().toISOString(),
  palette,
  fonts,
  typeScale,
  spacing,
  radius,
  assets: { logoUrl: h?.logo ?? null, faviconUrl: h?.meta.favicon ?? null, ogImage: h?.meta.ogImage ?? null },
  stack,
  responsive,
  note,
}

mkdirSync(OUT, { recursive: true })
const mdPath = join(OUT, 'legacy-audit.md')
const jsonPath = join(OUT, 'legacy-tokens.json')
writeFileSync(mdPath, L.join('\n'))
writeFileSync(jsonPath, JSON.stringify(tokensJson, null, 2) + '\n')

console.log(`✓ referto → ${mdPath}`)
console.log(`✓ token   → ${jsonPath}`)
console.log(`  palette: ${palette.map((p) => `${p.hex}(${p.ruolo})`).slice(0, 5).join(' ') || 'n/d'}`)
console.log(`  fonts:   ${fonts.map((f) => f.family).join(', ') || 'n/d'} · typeScale h1 ${typeScale.h1 ?? 'n/d'} / body ${typeScale.body ?? 'n/d'}`)
console.log(`  stack:   ${stack.length ? stack.join(', ') : '(nessuna firma)'}`)
console.log(`  responsive 390px: ${responsive === null ? 'non verificato' : responsive ? 'sì' : 'NO'}`)
if (note.length) for (const n of note) console.log('  ⚠', n)
