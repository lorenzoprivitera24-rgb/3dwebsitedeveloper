#!/usr/bin/env node
// recon-fingerprint.mjs — fingerprint statico dello stack di un sito (modulo di ricognizione Web3D Kit, playbook §9)
// Uso: node recon-fingerprint.mjs https://sito1 https://sito2 ...
// Output: <RECON_OUT>/<dominio>.json + cache dei bundle in <RECON_OUT>/cache/<dominio>/
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT = process.env.RECON_OUT || '.'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const HEADERS = {
  'user-agent': UA,
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.8,it;q=0.6',
}

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
  ['motion: ScrollSmoother', /ScrollSmoother/],
  ['motion: SplitText', /SplitText/],
  ['motion: ScrambleText', /ScrambleText/],
  ['motion: Draw/MorphSVG', /DrawSVGPlugin|MorphSVGPlugin/],
  ['motion: Flip', /Flip\.from|FlipPlugin|gsap\/Flip/],
  ['motion: lenis', /lenis|Lenis/],
  ['motion: locomotive-scroll', /locomotive/i],
  ['motion: framer-motion / motion', /framer-motion|motion\/react|motion-dom|popmotion|LazyMotion/],
  ['motion: anime.js', /animejs|createTimeline\(|createScope\(|onScroll\(/],
  ['motion: theatre.js', /@theatre|theatrejs/],
  ['motion: split-type', /split-type|SplitType/],
  ['3d: three.js', /three\.module|three\.webgpu|WebGLRenderer|isMesh|BufferGeometry/],
  ['3d: webgpu', /WebGPURenderer|navigator\.gpu|isWebGPURenderer|GPUShaderStage/],
  ['3d: tsl / node materials', /three\/tsl|NodeMaterial|colorNode|positionNode|MaterialX/],
  ['3d: react-three-fiber', /@react-three|react-three-fiber|useFrame\(|useThree\(/],
  ['3d: drei', /@react-three\/drei|useGLTF|PerformanceMonitor|Lightformer/],
  ['3d: postprocessing', /EffectComposer|UnrealBloomPass|postprocessing|N8AO/],
  ['3d: ogl', /["']ogl["']|OGLRenderingContext|from"ogl"/],
  ['3d: curtains.js', /curtainsjs|curtains\.js|new Curtains/],
  ['3d: pixi.js', /pixi\.js|PIXI\./],
  ['3d: babylon', /babylonjs|BABYLON/],
  ['3d: spline', /splinetool|spline\.design/],
  ['asset: glb/gltf', /\.glb\b|\.gltf\b|GLTFLoader/],
  ['asset: draco', /draco_decoder|DRACOLoader|dracoLoader/i],
  ['asset: meshopt', /meshopt|EXT_meshopt/i],
  ['asset: ktx2/basis', /\.ktx2|KTX2Loader|basis_transcoder/],
  ['asset: hdr/exr', /\.hdr\b|\.exr\b|RGBELoader|EXRLoader/],
  ['shader: glsl inline', /precision highp float|uniform\s+vec[234]|varying\s+vec|fragmentShader|vertexShader|#include <common>/],
  ['shader: wgsl', /@fragment|@vertex|var<uniform>/],
  ['transition: View Transitions API', /startViewTransition/],
  ['transition: barba.js', /barba\.js|@barba\/core|barbaWrapper/],
  ['transition: swup', /\bswup\b/i],
  ['transition: taxi (unseenco)', /@unseenco\/taxi|unseenco/],
  ['transition: highway', /highway\.js|Highway\.Core/],
  ['scroll: virtual-scroll / normalize-wheel', /virtual-scroll|normalizeWheel/],
  ['perf: detect-gpu', /detect-gpu|getGPUTier/],
  ['a11y: prefers-reduced-motion gestito', /prefers-reduced-motion/],
  ['font: fontshare/pangram/typekit', /fontshare|pangram|typekit|use\.typekit/],
]

const VERSION_RES = [
  ['gsap', /version:"(3\.[0-9]+\.[0-9]+)"/],
  ['three REVISION', /REVISION\s*=\s*["']([0-9]+[a-z]*)["']/],
  ['lenis', /version\s*[:=]\s*["']([0-9]+\.[0-9]+\.[0-9]+)["']/],
  ['react', /["'](1[89]\.[0-9]+\.[0-9]+)["']/],
]

async function get(url, max = 4 * 1024 * 1024) {
  try {
    const res = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(25000) })
    const buf = Buffer.from(await res.arrayBuffer())
    return { ok: res.ok, status: res.status, url: res.url, text: buf.subarray(0, max).toString('utf8'), bytes: buf.length, ctype: res.headers.get('content-type') || '' }
  } catch (e) {
    return { ok: false, status: 0, url, text: '', bytes: 0, error: String(e && e.cause ? e.cause : e) }
  }
}

const abs = (base, u) => { try { return new URL(u, base).href } catch { return null } }
const short = (u) => u === '(html)' ? u : u.replace(/^https?:\/\//, '').slice(0, 90)
const sane = (u) => u.replace(/[^\w.-]+/g, '_').slice(-120)

async function recon(site) {
  const domain = new URL(site).hostname.replace(/^www\./, '')
  const cacheDir = join(OUT, 'cache', domain)
  mkdirSync(cacheDir, { recursive: true })
  const page = await get(site)
  const out = { site, finalUrl: page.url, status: page.status, error: page.error || null, generator: null, jsWeightBytes: 0, filesScanned: 0, scripts: [], hits: {}, versions: {}, assets: {}, notes: [] }
  if (!page.text) { writeFileSync(join(OUT, domain + '.json'), JSON.stringify(out, null, 2)); return out }
  const html = page.text
  writeFileSync(join(cacheDir, '_index.html'), html)
  out.generator = html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)/i)?.[1] || null

  // livello 1: script, modulepreload, stylesheet dall'HTML
  const scriptSrcs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m => m[1])
  const preloads = [...html.matchAll(/<link[^>]+rel=["'](?:modulepreload|preload)["'][^>]*href=["']([^"']+\.m?js[^"']*)["']/g)].map(m => m[1])
  const cssHrefs = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/g)].map(m => m[1])
  const jsUrls = [...new Set([...scriptSrcs, ...preloads].map(u => abs(page.url, u)).filter(Boolean))].slice(0, 25)
  const cssUrls = [...new Set(cssHrefs.map(u => abs(page.url, u)).filter(Boolean))].slice(0, 6)

  const fetched = await Promise.all([...jsUrls, ...cssUrls].map(async u => ({ name: u, ...(await get(u)) })))
  const corpus = [{ name: '(html)', text: html, bytes: html.length }]
  for (const f of fetched) if (f.text && f.status === 200) { corpus.push(f); writeFileSync(join(cacheDir, sane(f.name)), f.text) }

  // livello 2: chunk lazy referenziate dentro le JS di livello 1 (Next/Vite/Astro/Framer modules)
  const extra = new Set()
  for (const { name, text } of corpus) {
    if (name === '(html)' || /\.css/.test(name)) continue
    const base = name
    for (const m of text.matchAll(/["']((?:\.?\/)?(?:_next\/static\/chunks|assets|_astro|_nuxt|static\/js)\/[\w@./~-]+\.m?js)["']/g)) {
      const u = abs(base, m[1]); if (u && !jsUrls.includes(u)) extra.add(u)
    }
    for (const m of text.matchAll(/https:\/\/framerusercontent\.com\/[\w./-]+\.mjs/g)) extra.add(m[0])
  }
  const extraUrls = [...extra].slice(0, 40)
  const fetched2 = await Promise.all(extraUrls.map(async u => ({ name: u, ...(await get(u)) })))
  for (const f of fetched2) if (f.text && f.status === 200) { corpus.push(f); writeFileSync(join(cacheDir, sane(f.name)), f.text) }

  out.filesScanned = corpus.length
  out.jsWeightBytes = corpus.filter(c => !/\.css/.test(c.name)).reduce((s, c) => s + (c.bytes || 0), 0)
  out.scripts = [...jsUrls, ...extraUrls].map(short)

  for (const { name, text } of corpus) {
    for (const [label, re] of SIGS) if (re.test(text)) (out.hits[label] ||= []).push(short(name))
    for (const [vl, re] of VERSION_RES) { const m = text.match(re); if (m) (out.versions[vl] ||= []).includes(m[1]) || (out.versions[vl] ||= []).push(m[1]) }
    for (const m of text.matchAll(/[\w./%-]{2,120}\.(glb|gltf|ktx2|hdr|exr|woff2?|mp4|webm)\b/g)) {
      const ext = m[1]; const base = m[0].split('/').pop()
      ;(out.assets[ext] ||= new Set()).add(base)
    }
  }
  for (const k of Object.keys(out.assets)) out.assets[k] = [...out.assets[k]].slice(0, 25)
  for (const k of Object.keys(out.hits)) out.hits[k] = [...new Set(out.hits[k])].slice(0, 6)

  writeFileSync(join(OUT, domain + '.json'), JSON.stringify(out, null, 2))
  return out
}

for (const site of process.argv.slice(2)) {
  const r = await recon(site)
  console.log(`\n=== ${site} → ${r.finalUrl} [${r.status}] ${r.error ? 'ERR ' + r.error : ''}`)
  if (r.generator) console.log('generator:', r.generator)
  console.log(`file scansionati: ${r.filesScanned} · peso JS scaricato: ${(r.jsWeightBytes / 1e6).toFixed(2)} MB`)
  for (const [label, files] of Object.entries(r.hits)) console.log('  •', label, '←', files.slice(0, 2).join(' , '))
  if (Object.keys(r.versions).length) console.log('  versioni:', JSON.stringify(r.versions))
  for (const [ext, list] of Object.entries(r.assets)) if (['glb', 'gltf', 'ktx2', 'hdr', 'exr'].includes(ext)) console.log(`  asset .${ext}:`, list.slice(0, 8).join(', '))
}
