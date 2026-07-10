#!/usr/bin/env node
// extract-brand.mjs — presa in carico del BRAND esistente del cliente (pre-S1).
// Da un logo (SVG preferito, o PNG/JPG) e opzionalmente da un'immagine di riferimento
// produce il brand kit machine-readable che alimenta S1 (creative-director) e il
// blueprint `logo-hero-3d` (estrusione / scomposizione particellare del logo).
//
// Uso: node scripts/extract-brand.mjs <logo.svg|logo.png> [immagine-riferimento.jpg] [--out brief/]
// Output: <out>/brand-kit.json (machine-readable) + <out>/brand-kit.md (sintesi per il gate umano)
//
// Come lavora:
//   - SVG → parsing leggero del testo, zero-deps: viewBox, path e comandi, fill/stroke
//     (attributi, style= e <style> interni con classi), fill-rule (evenodd = rischio
//     triangolazione per ExtrudeGeometry), gradienti, <image> raster embedded, <text>
//     non convertito in tracciati, bbox stimata dai dati dei path (safe area).
//   - PNG/JPG (logo o riferimento) → playwright-core + Chrome for Testing in cache
//     (MAI download del browser): l'immagine va in un <canvas> 64×64, i pixel campionati
//     vengono quantizzati per distanza RGB → 5-8 colori dominanti con peso, escludendo
//     bianco/trasparente di sfondo se copre >40% dell'immagine.
//   - Budget particelle (formula, vedi stimaBudgetParticelle): copertura del logo
//     (pixel non trasparenti / totale campionato per i raster; area safeArea / area
//     viewBox per gli SVG) × cap piattaforma → mobile ≤ 15k, desktop ≤ 60k particelle.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
import { homedir } from 'node:os'

// ---------------------------------------------------------------------------
// Argomenti
// ---------------------------------------------------------------------------
const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(name)
  if (i === -1) return fallback
  const v = args[i + 1]
  args.splice(i, 2)
  return v
}
const outDir = resolve(opt('--out', 'brief'))
const logoPath = args[0] ? resolve(args[0]) : null
const refPath = args[1] ? resolve(args[1]) : null

if (!logoPath) {
  console.error('Uso: node scripts/extract-brand.mjs <logo.svg|logo.png> [immagine-riferimento.jpg] [--out brief/]')
  process.exit(1)
}
const logoExt = extname(logoPath).toLowerCase()
const RASTER_EXT = ['.png', '.jpg', '.jpeg', '.webp']
if (logoExt !== '.svg' && !RASTER_EXT.includes(logoExt)) {
  console.error(`✗ Formato logo non supportato: ${logoExt} (accetto .svg, .png, .jpg, .jpeg, .webp)`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Colori: normalizzazione e distanza
// ---------------------------------------------------------------------------
const NAMED = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000',
  blue: '#0000ff', gray: '#808080', grey: '#808080', yellow: '#ffff00',
  orange: '#ffa500', purple: '#800080', navy: '#000080', silver: '#c0c0c0',
}
const rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

/** #rgb/#rrggbb/rgb()/nome → #rrggbb, oppure null (none/url()/currentColor/ignoto). */
function normalizeColor(v) {
  if (!v) return null
  v = String(v).trim().toLowerCase()
  if (v === 'none' || v === 'transparent' || v === 'currentcolor' || v.startsWith('url(')) return null
  if (NAMED[v]) return NAMED[v]
  let m = v.match(/^#([0-9a-f]{3})$/)
  if (m) return '#' + [...m[1]].map((c) => c + c).join('')
  m = v.match(/^#([0-9a-f]{6})$/)
  if (m) return '#' + m[1]
  m = v.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/)
  if (m) return rgbToHex(+m[1], +m[2], +m[3])
  return null
}
const distRGB = (a, b) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  return Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2])
}

// ---------------------------------------------------------------------------
// SVG: parsing leggero (regex, zero-deps)
// ---------------------------------------------------------------------------
/** Stima bbox di un attributo d= : endpoint + punti di controllo (sovrastima sicura). */
function pathBBox(d, bbox) {
  const tokens = [...d.matchAll(/([a-zA-Z])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/g)]
    .map((m) => m[1] ?? Number(m[2]))
  let cx = 0, cy = 0, sx = 0, sy = 0, cmd = null, i = 0
  const add = (x, y) => {
    bbox.minX = Math.min(bbox.minX, x); bbox.minY = Math.min(bbox.minY, y)
    bbox.maxX = Math.max(bbox.maxX, x); bbox.maxY = Math.max(bbox.maxY, y)
  }
  const num = () => tokens[i++]
  // quanti parametri consuma ogni comando (una ripetizione)
  const ARITY = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 }
  while (i < tokens.length) {
    if (typeof tokens[i] === 'string') cmd = tokens[i++]
    if (!cmd) break
    const lower = cmd.toLowerCase()
    const rel = cmd === lower
    if (lower === 'z') { cx = sx; cy = sy; continue }
    if (ARITY[lower] === undefined) break // comando ignoto: fermati (stima parziale)
    if (typeof tokens[i] === 'string') continue // comando senza parametri consumabili
    switch (lower) {
      case 'm': case 'l': case 't': {
        const x = num(), y = num()
        cx = rel ? cx + x : x; cy = rel ? cy + y : y
        add(cx, cy)
        if (lower === 'm') { sx = cx; sy = cy; cmd = rel ? 'l' : 'L' } // M implicito → L
        break
      }
      case 'h': { const x = num(); cx = rel ? cx + x : x; add(cx, cy); break }
      case 'v': { const y = num(); cy = rel ? cy + y : y; add(cx, cy); break }
      case 'c': case 's': case 'q': {
        const n = ARITY[lower]
        const pts = Array.from({ length: n / 2 }, () => [num(), num()])
        for (const [px, py] of pts) add(rel ? cx + px : px, rel ? cy + py : py)
        const [ex, ey] = pts[pts.length - 1]
        cx = rel ? cx + ex : ex; cy = rel ? cy + ey : ey
        break
      }
      case 'a': {
        num(); num(); num(); num(); num() // rx ry rot large-arc sweep: ignorati (solo endpoint)
        const x = num(), y = num()
        cx = rel ? cx + x : x; cy = rel ? cy + y : y
        add(cx, cy)
        break
      }
    }
  }
}

/** style="fill:#abc; stroke:red" → { fill: '#abc', stroke: 'red', ... } */
function parseStyleDecls(text) {
  const props = {}
  for (const decl of (text ?? '').split(';')) {
    const idx = decl.indexOf(':')
    if (idx === -1) continue
    const k = decl.slice(0, idx).trim().toLowerCase()
    const v = decl.slice(idx + 1).trim()
    if (k && v) props[k] = v
  }
  return props
}

function parseSvg(svgText, file) {
  const note = []
  const viewBox = svgText.match(/viewBox\s*=\s*["']([^"']+)["']/)?.[1] ?? null

  // <style> interni: .classe { fill: ...; stroke: ...; fill-rule: ... }
  const cssByClass = {}
  for (const styleBlock of svgText.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    for (const rule of styleBlock[1].matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const props = parseStyleDecls(rule[2])
      for (const sel of rule[1].split(',')) {
        const cls = sel.trim().match(/^\.([\w-]+)$/)?.[1]
        if (cls) cssByClass[cls] = { ...(cssByClass[cls] ?? {}), ...props }
      }
    }
  }

  const haGradient = /<(linear|radial)Gradient\b/i.test(svgText) || /url\(#/.test(svgText)
  const haRaster = /<image\b/i.test(svgText)
  const haText = /<text\b/i.test(svgText)

  const colorCount = new Map() // `${hex}|${dove}` → occorrenze
  const addColor = (raw, dove) => {
    const hex = normalizeColor(raw)
    if (!hex) return
    const key = `${hex}|${dove}`
    colorCount.set(key, (colorCount.get(key) ?? 0) + 1)
  }

  // stop dei gradienti → palette (l'estrusione li perde, il fluido li sfrutta)
  for (const stop of svgText.matchAll(/<stop\b[^>]*>/gi)) {
    const tag = stop[0]
    addColor(tag.match(/stop-color\s*=\s*["']([^"']+)["']/)?.[1], 'gradient')
    addColor(parseStyleDecls(tag.match(/style\s*=\s*["']([^"']*)["']/)?.[1])['stop-color'], 'gradient')
  }

  let pathCount = 0
  let complessita = 0
  const fillRules = new Set()
  const pathProblematici = []
  const bbox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }

  // Scansione di tutti i tag "visibili" (path + forme base + gruppi): fill/stroke/fill-rule
  const TAG_RE = /<(path|rect|circle|ellipse|polygon|polyline|line|g|svg|text)\b((?:[^>"']|"[^"]*"|'[^']*')*)\/?>/gi
  for (const m of svgText.matchAll(TAG_RE)) {
    const [, tag, attrText] = m
    const attrs = {}
    for (const a of attrText.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      attrs[a[1].toLowerCase()] = a[2] ?? a[3]
    }
    // paint effettiva: attributo < style= < classi CSS (le classi vincono come nei browser
    // reali solo con specificità — qui semplifichiamo: raccogliamo TUTTE le fonti)
    const styleProps = parseStyleDecls(attrs.style)
    const classProps = (attrs.class ?? '')
      .split(/\s+/)
      .reduce((acc, c) => ({ ...acc, ...(cssByClass[c] ?? {}) }), {})
    addColor(attrs.fill, 'fill')
    addColor(styleProps.fill, 'fill')
    addColor(classProps.fill, 'fill')
    addColor(attrs.stroke, 'stroke')
    addColor(styleProps.stroke, 'stroke')
    addColor(classProps.stroke, 'stroke')

    const fillRule = attrs['fill-rule'] ?? styleProps['fill-rule'] ?? classProps['fill-rule']
    if (fillRule) fillRules.add(fillRule)

    if (tag.toLowerCase() === 'path') {
      pathCount++
      const d = attrs.d ?? ''
      const comandi = (d.match(/[MmLlHhVvCcSsQqTtAaZz]/g) ?? []).length
      complessita += comandi
      if (d) pathBBox(d, bbox)
      if (fillRule === 'evenodd') {
        pathProblematici.push(`path #${pathCount} (${comandi} comandi): fill-rule=evenodd`)
      }
    }
    // forme base → bbox
    const n = (k) => Number(attrs[k] ?? 0)
    if (tag.toLowerCase() === 'rect' && attrs.width) {
      pathBBox(`M${n('x')} ${n('y')} h${n('width')} v${n('height')}`, bbox)
    }
    if (tag.toLowerCase() === 'circle' && attrs.r) {
      pathBBox(`M${n('cx') - n('r')} ${n('cy') - n('r')} h${2 * n('r')} v${2 * n('r')}`, bbox)
    }
    if (tag.toLowerCase() === 'ellipse' && attrs.rx) {
      pathBBox(`M${n('cx') - n('rx')} ${n('cy') - n('ry')} h${2 * n('rx')} v${2 * n('ry')}`, bbox)
    }
    if (['polygon', 'polyline'].includes(tag.toLowerCase()) && attrs.points) {
      const nums = attrs.points.match(/-?\d*\.?\d+/g) ?? []
      for (let i = 0; i + 1 < nums.length; i += 2) pathBBox(`M${nums[i]} ${nums[i + 1]}`, bbox)
    }
  }

  // safe area: bbox stimata dai tracciati; fallback = viewBox
  const r2 = (v) => Math.round(v * 100) / 100
  let safeArea = null
  if (Number.isFinite(bbox.minX)) {
    safeArea = { x: r2(bbox.minX), y: r2(bbox.minY), width: r2(bbox.maxX - bbox.minX), height: r2(bbox.maxY - bbox.minY) }
  } else if (viewBox) {
    const [x, y, w, h] = viewBox.split(/[\s,]+/).map(Number)
    safeArea = { x, y, width: w, height: h }
    note.push('safe area = viewBox (nessun tracciato con coordinate stimabili)')
  }

  if (haText) note.push('⚠️ <text> non convertito in tracciati: convertire in path (Illustrator/Inkscape "object to path") prima dell\'estrusione')
  if (haRaster) note.push('⚠️ <image> raster embedded nell\'SVG: quella parte non è estrudibile né scomponibile in path')
  if (!viewBox) note.push('viewBox assente: normalizzare l\'SVG prima di usarlo come geometria')
  if (colorCount.size === 0) note.push('nessun colore esplicito trovato (fill di default nero?): verificare a mano')

  const colori = [...colorCount.keys()].map((k) => {
    const [hex, dove] = k.split('|')
    return { hex, dove }
  })
  return {
    logo: {
      file: basename(file),
      formato: 'svg',
      viewBox,
      pathCount,
      complessita,
      colori,
      haGradient,
      haRaster,
      fillRules: [...fillRules],
      safeArea,
    },
    colorCount, // interno: pesi per la palette
    pathProblematici,
    haText,
    note,
  }
}

// ---------------------------------------------------------------------------
// Raster (PNG/JPG): campionamento pixel via playwright-core + Chrome in cache
// ---------------------------------------------------------------------------
const GRID = 64 // griglia di campionamento GRID×GRID
const CHROME =
  process.env.CHROMIUM_PATH ??
  `${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`

let browserPromise = null
async function getBrowser() {
  if (!browserPromise) {
    const { chromium } = await import('playwright-core')
    browserPromise = chromium.launch({ executablePath: CHROME, headless: true })
  }
  return browserPromise
}

/** Carica l'immagine in un <canvas> GRID×GRID e restituisce pixel RGBA + dimensioni native. */
async function sampleRaster(filePath) {
  const ext = extname(filePath).toLowerCase()
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
  const dataUri = `data:${mime};base64,${readFileSync(filePath).toString('base64')}`
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    return await page.evaluate(
      async ({ src, grid }) => {
        const img = new Image()
        await new Promise((res, rej) => {
          img.onload = res
          img.onerror = () => rej(new Error('immagine non decodificabile'))
          img.src = src
        })
        const canvas = document.createElement('canvas')
        canvas.width = grid
        canvas.height = grid
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, 0, 0, grid, grid)
        const { data } = ctx.getImageData(0, 0, grid, grid)
        const px = []
        for (let i = 0; i < data.length; i += 4) px.push([data[i], data[i + 1], data[i + 2], data[i + 3]])
        return { px, width: img.naturalWidth, height: img.naturalHeight }
      },
      { src: dataUri, grid: GRID },
    )
  } finally {
    await page.close()
  }
}

const isWhiteish = ([r, g, b]) => r > 240 && g > 240 && b > 240

/**
 * Quantizzazione greedy per distanza RGB (soglia 40): media mobile per cluster.
 * Esclude il bianco/trasparente di SFONDO solo se copre >40% dei campioni.
 */
function quantize(px, maxColors = 8) {
  const opachi = px.filter((p) => p[3] >= 32)
  const nTrasparenti = px.length - opachi.length
  const nBianchi = opachi.filter(isWhiteish).length
  const quotaSfondo = (nTrasparenti + nBianchi) / px.length
  const escludiSfondo = quotaSfondo > 0.4
  const pool = escludiSfondo ? opachi.filter((p) => !isWhiteish(p)) : opachi

  const clusters = []
  for (const [r, g, b] of pool) {
    let best = null
    let bestD = Infinity
    for (const c of clusters) {
      const d = Math.hypot(r - c.r, g - c.g, b - c.b)
      if (d < bestD) { bestD = d; best = c }
    }
    if (best && bestD < 40) {
      best.r = (best.r * best.n + r) / (best.n + 1)
      best.g = (best.g * best.n + g) / (best.n + 1)
      best.b = (best.b * best.n + b) / (best.n + 1)
      best.n++
    } else {
      clusters.push({ r, g, b, n: 1 })
    }
  }
  clusters.sort((a, b) => b.n - a.n)
  const top = clusters.slice(0, maxColors).filter((c) => c.n >= pool.length * 0.005) // rumore fuori
  const tot = top.reduce((s, c) => s + c.n, 0) || 1
  return {
    colori: top.map((c) => ({ hex: rgbToHex(c.r, c.g, c.b), peso: Math.round((c.n / tot) * 1000) / 1000 })),
    coperturaOpachi: opachi.length / px.length,
    coperturaSoggetto: pool.length / px.length,
    escludiSfondo,
  }
}

/** bbox (in pixel immagine) delle celle non trasparenti / non di sfondo della griglia. */
function rasterSafeArea(px, width, height, escludiSfondo) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let i = 0; i < px.length; i++) {
    const p = px[i]
    if (p[3] < 32 || (escludiSfondo && isWhiteish(p))) continue
    const gx = i % GRID
    const gy = Math.floor(i / GRID)
    minX = Math.min(minX, gx); minY = Math.min(minY, gy)
    maxX = Math.max(maxX, gx); maxY = Math.max(maxY, gy)
  }
  if (!Number.isFinite(minX)) return null
  const sx = width / GRID
  const sy = height / GRID
  return {
    x: Math.round(minX * sx),
    y: Math.round(minY * sy),
    width: Math.round((maxX - minX + 1) * sx),
    height: Math.round((maxY - minY + 1) * sy),
  }
}

// ---------------------------------------------------------------------------
// Euristiche 3D
// ---------------------------------------------------------------------------
/**
 * Budget particelle = copertura × cap piattaforma, con pavimento minimo.
 *   copertura raster = pixel del soggetto / pixel campionati (griglia 64×64)
 *   copertura SVG    = area(safeArea) / area(viewBox), clamp 0..1
 *   cap: mobile 15_000, desktop 60_000 (limiti da CLAUDE.md / budget mobile-first)
 */
function stimaBudgetParticelle(copertura) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  return {
    mobile: clamp(Math.round(copertura * 15_000), 1_000, 15_000),
    desktop: clamp(Math.round(copertura * 60_000), 2_000, 60_000),
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const kit = { logo: null, palette: [], trattamenti3d: {}, note: [] }
let logoPaletteRaw = [] // [{hex, peso}] non ancora fusa col riferimento
let copertura = 0.5 // default prudente se non stimabile

if (logoExt === '.svg') {
  const svgText = readFileSync(logoPath, 'utf8')
  const parsed = parseSvg(svgText, logoPath)
  kit.logo = parsed.logo
  kit.note.push(...parsed.note)

  // palette dal logo: peso = occorrenze del colore / totale occorrenze
  const totale = [...parsed.colorCount.values()].reduce((s, n) => s + n, 0) || 1
  const perHex = new Map()
  for (const [key, n] of parsed.colorCount) {
    const hex = key.split('|')[0]
    perHex.set(hex, (perHex.get(hex) ?? 0) + n)
  }
  logoPaletteRaw = [...perHex].map(([hex, n]) => ({ hex, peso: n / totale }))

  // copertura per il budget particelle: area safeArea / area viewBox
  if (kit.logo.safeArea && kit.logo.viewBox) {
    const [, , vw, vh] = kit.logo.viewBox.split(/[\s,]+/).map(Number)
    const { width, height } = kit.logo.safeArea
    if (vw > 0 && vh > 0) copertura = Math.max(0, Math.min(1, (width * height) / (vw * vh)))
  }

  // estrusione: SVG a tracciati = ok; evenodd/testo/raster sono i rischi reali
  const evenodd = parsed.logo.fillRules.includes('evenodd')
  const problemi = []
  if (evenodd) problemi.push('fill-rule=evenodd: i buchi dipendono dalla regola di riempimento — ExtrudeGeometry/triangolazione può riempirli o bucare male; convertire i buchi in sub-path con orientamento opposto (holes espliciti in ShapePath)')
  if (parsed.haText) problemi.push('<text> non convertito: il glifo non esiste come tracciato')
  if (parsed.logo.haRaster) problemi.push('<image> raster embedded: nessun tracciato da estrudere per quella parte')
  kit.trattamenti3d.estrusione = {
    fattibile: parsed.logo.pathCount > 0 && !parsed.logo.haRaster,
    perche: parsed.logo.pathCount === 0
      ? 'nessun <path> nel file: nulla da estrudere (solo forme base o raster?)'
      : parsed.logo.haRaster
        ? 'raster embedded nell\'SVG: serve la vettorializzazione completa prima'
        : problemi.length > 0
          ? `tracciati presenti ma con rischi: ${problemi.join(' · ')}`
          : `${parsed.logo.pathCount} tracciati puliti, ${parsed.logo.complessita} comandi totali: estrusione diretta con ShapePath → ExtrudeGeometry`,
    ...(parsed.pathProblematici.length > 0 ? { pathProblematici: parsed.pathProblematici } : {}),
  }
  if (parsed.logo.haGradient) {
    kit.note.push('gradiente nel logo: l\'estrusione appiattisce a un colore per mesh — riprodurre il gradiente come materiale TSL (mix su posizione), non come fill')
  }
} else {
  // logo raster: campiona pixel
  const { px, width, height } = await sampleRaster(logoPath)
  const q = quantize(px)
  kit.logo = {
    file: basename(logoPath),
    formato: logoExt.slice(1),
    dimensioni: { width, height },
    colori: q.colori.map(({ hex }) => ({ hex, dove: 'fill' })),
    haGradient: false, // non rilevabile in modo affidabile da un raster: vedi note
    haRaster: true,
    fillRules: [],
    safeArea: rasterSafeArea(px, width, height, q.escludiSfondo),
  }
  logoPaletteRaw = q.colori
  copertura = q.coperturaSoggetto
  kit.note.push('logo raster: haGradient non è rilevabile in modo affidabile dai pixel — verificare a occhio')
  if (q.escludiSfondo) kit.note.push('sfondo bianco/trasparente >40%: escluso dalla palette e dalla safe area')
  if (width < 512 || height < 512) kit.note.push(`⚠️ logo raster piccolo (${width}×${height}): chiedere l'SVG originale o un PNG ≥1024px`)

  kit.trattamenti3d.estrusione = {
    fattibile: false,
    perche: 'il logo è raster (pixel, non tracciati): per estrudere serve l\'SVG originale o una vettorializzazione (potrace/manuale) da far validare al cliente',
  }
}

// particelle: sempre fattibili (dal raster o rasterizzando l'SVG a maschera)
kit.trattamenti3d.particelle = {
  fattibile: true,
  budgetSuggerito: stimaBudgetParticelle(copertura),
  // formula annotata anche a runtime, per chi legge solo il JSON:
  formula: `budget = copertura(${Math.round(copertura * 100) / 100}) × cap piattaforma (mobile 15k / desktop 60k), clamp con pavimento 1k/2k`,
}

// fluido: il logo funziona come maschera/SDF indipendentemente dal formato
kit.trattamenti3d.fluido = {
  fattibile: true,
  note: logoExt === '.svg'
    ? 'rasterizzare l\'SVG a texture alpha (o SDF) e usarla come maschera del campo fluido; i colori del gradiente sono ideali come rampa colore'
    : 'usare il canale alpha (o il negativo dello sfondo) come maschera del campo fluido; con JPG senza alpha serve il chroma-key sullo sfondo',
}

// ---------------------------------------------------------------------------
// Immagine di riferimento (opzionale) → fusione palette
// ---------------------------------------------------------------------------
let refInfo = null
if (refPath) {
  const refExt = extname(refPath).toLowerCase()
  if (!RASTER_EXT.includes(refExt)) {
    console.error(`✗ Immagine di riferimento non supportata: ${refExt} (accetto ${RASTER_EXT.join(', ')})`)
    process.exit(1)
  }
  const { px, width, height } = await sampleRaster(refPath)
  const q = quantize(px)
  refInfo = { file: basename(refPath), dimensioni: { width, height }, colori: q.colori }
  if (q.escludiSfondo) kit.note.push(`riferimento ${basename(refPath)}: sfondo bianco/trasparente >40% escluso dalla palette`)
}

// fusione palette: logo 60% + riferimento 40% (il logo comanda il brand),
// colori entro distanza RGB 32 vengono fusi sul colore più pesante
{
  const weighted = [
    ...logoPaletteRaw.map(({ hex, peso }) => ({ hex, peso: peso * (refInfo ? 0.6 : 1) })),
    ...(refInfo ? refInfo.colori.map(({ hex, peso }) => ({ hex, peso: peso * 0.4 })) : []),
  ]
  const merged = []
  for (const c of weighted.sort((a, b) => b.peso - a.peso)) {
    const near = merged.find((m) => distRGB(m.hex, c.hex) < 32)
    if (near) near.peso += c.peso
    else merged.push({ ...c })
  }
  const tot = merged.reduce((s, c) => s + c.peso, 0) || 1
  kit.palette = merged
    .sort((a, b) => b.peso - a.peso)
    .slice(0, 8)
    .map((c) => ({ hex: c.hex, peso: Math.round((c.peso / tot) * 1000) / 1000 }))
}
if (refInfo) kit.riferimento = refInfo

// chiudi il browser se è stato aperto
if (browserPromise) await (await browserPromise).close()

// ---------------------------------------------------------------------------
// Output: brand-kit.json + brand-kit.md
// ---------------------------------------------------------------------------
mkdirSync(outDir, { recursive: true })
const OUT_JSON = join(outDir, 'brand-kit.json')
const OUT_MD = join(outDir, 'brand-kit.md')
writeFileSync(OUT_JSON, JSON.stringify(kit, null, 2) + '\n')

const e3 = kit.trattamenti3d.estrusione
const p3 = kit.trattamenti3d.particelle
const f3 = kit.trattamenti3d.fluido
const si = (b) => (b ? 'sì' : 'no')
const md = `# Brand kit — ${kit.logo.file}
> GENERATO da scripts/extract-brand.mjs — input per S1 (creative-director) e per il blueprint logo-hero-3d.

## Logo
- **File**: ${kit.logo.file} (${kit.logo.formato.toUpperCase()})
${kit.logo.viewBox ? `- **viewBox**: ${kit.logo.viewBox}` : kit.logo.dimensioni ? `- **Dimensioni**: ${kit.logo.dimensioni.width}×${kit.logo.dimensioni.height}px` : ''}
${kit.logo.pathCount !== undefined ? `- **Tracciati**: ${kit.logo.pathCount} path, ${kit.logo.complessita} comandi totali` : ''}
- **Gradiente**: ${si(kit.logo.haGradient)} · **Raster**: ${si(kit.logo.haRaster)}${kit.logo.fillRules.length ? ` · **fill-rule**: ${kit.logo.fillRules.join(', ')}` : ''}
- **Safe area**: ${kit.logo.safeArea ? `x ${kit.logo.safeArea.x}, y ${kit.logo.safeArea.y}, ${kit.logo.safeArea.width}×${kit.logo.safeArea.height}` : 'non stimabile'}

## Palette
${kit.palette.map((c) => `- \`${c.hex}\` — peso ${Math.round(c.peso * 100)}%`).join('\n')}
${refInfo ? `\n(palette fusa: logo 60% + riferimento *${refInfo.file}* 40%)` : ''}

## Trattamenti 3D
| Trattamento | Fattibile | Dettaglio |
|---|---|---|
| Estrusione | ${si(e3.fattibile)} | ${e3.perche} |
| Particelle | ${si(p3.fattibile)} | budget: ${p3.budgetSuggerito.mobile.toLocaleString('it-IT')} mobile / ${p3.budgetSuggerito.desktop.toLocaleString('it-IT')} desktop |
| Fluido | ${si(f3.fattibile)} | ${f3.note} |
${e3.pathProblematici?.length ? `\n**Path problematici (estrusione):**\n${e3.pathProblematici.map((p) => `- ${p}`).join('\n')}` : ''}

## Note e avvisi
${kit.note.length ? kit.note.map((n) => `- ${n}`).join('\n') : '- nessuno'}
`
writeFileSync(OUT_MD, md.replace(/\n{3,}/g, '\n\n'))

// ---------------------------------------------------------------------------
// Riepilogo a console
// ---------------------------------------------------------------------------
if (kit.logo.formato === 'svg') {
  console.log(`✓ logo SVG: ${kit.logo.pathCount} path · ${kit.logo.complessita} comandi · ${kit.logo.colori.length} colori · gradiente: ${si(kit.logo.haGradient)}`)
} else {
  console.log(`✓ logo ${kit.logo.formato.toUpperCase()}: ${kit.logo.dimensioni.width}×${kit.logo.dimensioni.height}px · ${kit.logo.colori.length} colori dominanti`)
}
console.log(`✓ palette (${kit.palette.length}): ${kit.palette.map((c) => `${c.hex} ${Math.round(c.peso * 100)}%`).join(' · ')}`)
console.log(`✓ estrusione: ${si(e3.fattibile)} · particelle: ${p3.budgetSuggerito.mobile.toLocaleString('it-IT')}/${p3.budgetSuggerito.desktop.toLocaleString('it-IT')} (mobile/desktop) · fluido: ${si(f3.fattibile)}`)
for (const n of kit.note) console.log(`  ⚠️ ${n.replace(/^⚠️\s*/, '')}`)
console.log(`✓ brand-kit → ${OUT_JSON}\n✓ brand-kit → ${OUT_MD}`)
