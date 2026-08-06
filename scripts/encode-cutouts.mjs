#!/usr/bin/env node
// encode-cutouts.mjs — la pipeline degli SCONTORNATI (cut-out), gemella DOM di encode-assets.mjs.
//
// Il genere «prodotto editoriale» (food, beverage, packaging, hardware) non si regge su GLB e
// KTX2: si regge su fotografia scontornata in alpha, impilata a strati e coreografata allo
// scroll. Questo script prende gli strati grezzi e li rende spedibili.
//
//   public/assets/raw/cutouts/<prodotto>/NN-<nome>.png   (NN crescente = dal BASSO verso l'ALTO
//                                                          della pila fisica)
//        ↓
//   public/assets/cutouts/<prodotto>/<nome>-<w>.avif|webp  + <nome>-shadow.webp
//   public/assets/cutouts/manifest.json
//
// LA REGOLA CHE FA FUNZIONARE TUTTO — **registrazione condivisa**. Gli strati NON si ritagliano
// uno per uno: si calcola il bounding box dell'UNIONE di tutti gli strati del prodotto e si
// estrae quello stesso rettangolo da ognuno. Ritagliare per strato allinea ogni PNG al proprio
// inchiostro e la pila si disallinea a video — è il bug numero uno di questo genere di sezione.
// Prezzo: ogni strato pesa un rettangolo quasi tutto trasparente. In AVIF/WebP le zone
// completamente trasparenti costano quasi zero, e in cambio il blueprint impila `position:
// absolute; inset: 0` senza offset da indovinare.
//
// Uso:
//   node scripts/encode-cutouts.mjs                     # tutti i prodotti in raw/cutouts
//   node scripts/encode-cutouts.mjs <prodotto>          # un prodotto solo
//   Flag: --widths 720,1200,1800   larghezze responsive (default)
//         --no-shadows             non generare le ombre di contatto
//         --quality-avif 52 --quality-webp 82
//
// Budget: uno strato ≤ 180 KB alla larghezza massima, un prodotto ≤ 900 KB totali (AVIF).
// Lo script stampa il peso per strato e per prodotto: se sfora, si riducono le larghezze.
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import sharp from 'sharp'

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  if (i !== -1) args.splice(i, 1)
  return i !== -1
}
const opt = (name, fallback) => {
  const i = args.indexOf(name)
  if (i === -1) return fallback
  const v = args[i + 1]
  args.splice(i, 2)
  return v
}

const NO_SHADOWS = flag('--no-shadows')
const WIDTHS = String(opt('--widths', '720,1200,1800'))
  .split(',')
  .map((w) => parseInt(w, 10))
  .filter(Boolean)
  .sort((a, b) => a - b)
const Q_AVIF = parseInt(opt('--quality-avif', '52'), 10)
const Q_WEBP = parseInt(opt('--quality-webp', '82'), 10)

const RAW = 'public/assets/raw/cutouts'
const OUT = 'public/assets/cutouts'
const BUDGET_LAYER = 180 * 1024
const BUDGET_PRODUCT = 900 * 1024

const kb = (n) => `${(n / 1024).toFixed(0)} KB`

/** bbox dell'inchiostro (alpha > soglia) di un PNG, in pixel. null se lo strato è vuoto. */
async function inkBox(file, threshold = 8) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    const row = y * width * channels
    for (let x = 0; x < width; x++) {
      if (data[row + x * channels + channels - 1] > threshold) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

/**
 * Ombra di contatto: la silhouette schiacciata, sfocata forte e SFUMATA A ELLISSE.
 *
 * La sfumatura non è un abbellimento. Schiacciare la sagoma di un oggetto alto — un cilindro,
 * una bottiglia, un panino — dà un rettangolo: i fianchi verticali riempiono ogni colonna, e
 * quello che finisce sotto lo strato è una BARRA nera, non un'ombra. È il difetto che si vede
 * subito a video e non si vede mai guardando il codice. La maschera radiale toglie gli angoli e
 * restituisce la pozza ellittica che l'occhio si aspetta sotto un oggetto appoggiato.
 */
async function bakeShadow(file, box, outPath) {
  const w = Math.max(48, Math.round(box.width / 2))
  const h = Math.max(12, Math.round(w * 0.16)) // schiacciamento: è una proiezione, non una copia
  const pad = Math.round(w * 0.18) // margine, se no la sfocatura viene tagliata di netto
  const W = w + pad * 2
  const H = h + pad * 2

  const silhouette = await sharp(file)
    .extract(box)
    .resize(w, h, { fit: 'fill' })
    .ensureAlpha()
    // la silhouette è l'alpha: annerisco i canali colore e tengo l'alpha com'è
    .composite([
      { input: { create: { width: w, height: h, channels: 3, background: '#000' } }, blend: 'in' },
    ])
    .toBuffer()

  const feather = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs><radialGradient id="f">
        <stop offset="0" stop-color="#fff" stop-opacity="1"/>
        <stop offset="0.5" stop-color="#fff" stop-opacity="0.9"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </radialGradient></defs>
      <ellipse cx="${W / 2}" cy="${H / 2}" rx="${W / 2}" ry="${H / 2}" fill="url(#f)"/>
    </svg>`,
  )

  await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: silhouette, left: pad, top: pad }])
    .blur(Math.max(6, w * 0.075))
    .png() // formato esplicito: un pipeline che nasce da `create` non ne ha uno, e il buffer
    .toBuffer() // senza formato non si può ri-aprire

    .then((blurred) =>
      sharp(blurred)
        .composite([{ input: feather, blend: 'dest-in' }])
        .webp({ quality: 72, alphaQuality: 90 })
        .toFile(outPath),
    )
}

async function encodeProduct(dir) {
  const id = basename(dir)
  const files = readdirSync(dir)
    .filter((f) => ['.png', '.webp'].includes(extname(f).toLowerCase()))
    .sort() // NN- crescente = dal basso verso l'alto della pila
    .map((f) => join(dir, f))

  if (files.length === 0) {
    console.warn(`  ⚠︎  ${id}: nessuno strato, salto`)
    return null
  }

  // 1. bounding box dell'UNIONE — la registrazione condivisa
  const boxes = []
  for (const f of files) {
    const b = await inkBox(f)
    if (!b) {
      console.warn(`  ⚠︎  ${basename(f)}: completamente trasparente, salto`)
      continue
    }
    boxes.push({ file: f, box: b })
  }
  if (boxes.length === 0) return null

  const meta = await sharp(boxes[0].file).metadata()
  const canvas = { width: meta.width, height: meta.height }
  for (const { file } of boxes) {
    const m = await sharp(file).metadata()
    if (m.width !== canvas.width || m.height !== canvas.height) {
      throw new Error(
        `${id}: gli strati devono condividere la stessa tela. ${basename(file)} è ${m.width}×${m.height}, atteso ${canvas.width}×${canvas.height}.`,
      )
    }
  }

  const union = boxes.reduce(
    (u, { box }) => ({
      left: Math.min(u.left, box.left),
      top: Math.min(u.top, box.top),
      right: Math.max(u.right, box.left + box.width),
      bottom: Math.max(u.bottom, box.top + box.height),
    }),
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
  )
  const unionBox = {
    left: union.left,
    top: union.top,
    width: union.right - union.left,
    height: union.bottom - union.top,
  }

  const outDir = join(OUT, id)
  mkdirSync(outDir, { recursive: true })

  const layers = []
  let productBytes = 0

  for (const { file, box } of boxes) {
    const name = basename(file, extname(file))
    const label = name.replace(/^\d+[-_]?/, '').replace(/[-_]/g, ' ')

    // 2. estrazione con il box CONDIVISO → registrazione preservata
    const extracted = await sharp(file).extract(unionBox).toBuffer()

    const sources = { avif: [], webp: [] }
    let layerBytes = 0
    // le larghezze richieste, più la nativa se nessuna la raggiunge: senza questo un box da
    // 1000 px con WIDTHS=[720,1200,1800] spedirebbe solo 720 e su schermo retina si vedrebbe.
    const widths = [...WIDTHS]
    if (!widths.some((w) => w >= unionBox.width * 0.95)) widths.push(unionBox.width)
    for (const w of widths) {
      if (w > unionBox.width * 1.05) continue // mai upscalare uno scontornato
      // gotcha sharp: si compone → toBuffer → si ridimensiona. Mai resize prima del composite.
      const resized = sharp(extracted).resize({ width: w, withoutEnlargement: true })
      const avifPath = join(outDir, `${name}-${w}.avif`)
      const webpPath = join(outDir, `${name}-${w}.webp`)
      await resized.clone().avif({ quality: Q_AVIF, effort: 4 }).toFile(avifPath)
      await resized.clone().webp({ quality: Q_WEBP, alphaQuality: 95 }).toFile(webpPath)
      sources.avif.push({ w, src: avifPath.replace(/^public\//, '/') })
      sources.webp.push({ w, src: webpPath.replace(/^public\//, '/') })
      layerBytes = Math.max(layerBytes, statSync(avifPath).size)
    }
    if (sources.avif.length === 0) {
      // sorgente più piccola della larghezza minima: si esporta comunque alla sua misura
      const w = unionBox.width
      const avifPath = join(outDir, `${name}-${w}.avif`)
      const webpPath = join(outDir, `${name}-${w}.webp`)
      await sharp(extracted).avif({ quality: Q_AVIF, effort: 4 }).toFile(avifPath)
      await sharp(extracted).webp({ quality: Q_WEBP, alphaQuality: 95 }).toFile(webpPath)
      sources.avif.push({ w, src: avifPath.replace(/^public\//, '/') })
      sources.webp.push({ w, src: webpPath.replace(/^public\//, '/') })
      layerBytes = statSync(avifPath).size
    }

    let shadow = null
    if (!NO_SHADOWS) {
      const p = join(outDir, `${name}-shadow.webp`)
      await bakeShadow(file, box, p)
      shadow = p.replace(/^public\//, '/')
    }

    // 3. dove sta l'inchiostro DENTRO il box condiviso, in frazioni: serve al blueprint per
    //    piazzare l'ombra sotto lo strato giusto e per sapere quanto è alto davvero.
    const ink = {
      x: (box.left - unionBox.left + box.width / 2) / unionBox.width,
      y: (box.top - unionBox.top + box.height) / unionBox.height, // base dell'inchiostro
      w: box.width / unionBox.width,
      h: box.height / unionBox.height,
    }

    productBytes += layerBytes
    if (layerBytes > BUDGET_LAYER) {
      console.warn(`  ⚠︎  ${name}: ${kb(layerBytes)} > budget strato ${kb(BUDGET_LAYER)}`)
    }
    console.log(`  · ${name.padEnd(22)} ${kb(layerBytes).padStart(8)}  ink ${(ink.w * 100).toFixed(0)}%×${(ink.h * 100).toFixed(0)}%`)

    layers.push({ id: name, label, ink, shadow, sources })
  }

  if (productBytes > BUDGET_PRODUCT) {
    console.warn(`  ⚠︎  ${id}: ${kb(productBytes)} totali > budget prodotto ${kb(BUDGET_PRODUCT)}`)
  }

  return {
    id,
    aspect: unionBox.width / unionBox.height,
    box: { width: unionBox.width, height: unionBox.height },
    layers, // ordine = dal basso verso l'alto della pila fisica
    bytes: productBytes,
  }
}

async function main() {
  if (!existsSync(RAW)) {
    console.error(`Manca ${RAW}/. Metti gli strati in ${RAW}/<prodotto>/NN-<nome>.png`)
    console.error(`Fixture di prova: node scripts/gen-cutout-fixture.mjs`)
    process.exit(1)
  }
  const only = args[0]
  const dirs = readdirSync(RAW)
    .map((d) => join(RAW, d))
    .filter((d) => statSync(d).isDirectory())
    .filter((d) => !only || basename(d) === only)

  if (dirs.length === 0) {
    console.error(only ? `Prodotto «${only}» non trovato in ${RAW}/` : `Nessun prodotto in ${RAW}/`)
    process.exit(1)
  }

  mkdirSync(OUT, { recursive: true })
  const products = {}
  for (const dir of dirs) {
    console.log(`\n▸ ${basename(dir)}`)
    const p = await encodeProduct(dir)
    if (p) products[p.id] = p
  }

  const manifestPath = join(OUT, 'manifest.json')
  // il manifesto è cumulativo: un prodotto ri-encodato sostituisce solo sé stesso
  let previous = {}
  if (existsSync(manifestPath)) {
    try {
      previous = JSON.parse(await import('node:fs').then((fs) => fs.readFileSync(manifestPath, 'utf8'))).products ?? {}
    } catch {
      previous = {}
    }
  }
  const merged = { ...previous, ...products }
  const manifest = {
    note: "GENERATO da scripts/encode-cutouts.mjs — non editare a mano. layers[] va dal BASSO verso l'ALTO della pila.",
    widths: WIDTHS,
    products: merged,
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  // gemello tipato e importabile, stessa convenzione di tokens.generated.ts: i blueprint
  // devono avere gli strati già in mano al mount (ScrollTrigger misura subito), quindi il
  // manifesto si importa, non si fetcha.
  const tsPath = 'src/lib/cutouts.generated.ts'
  writeFileSync(
    tsPath,
    `// GENERATO da scripts/encode-cutouts.mjs — NON EDITARE A MANO\n` +
      `import type { CutoutManifest } from './cutouts'\n\n` +
      `export const cutouts: CutoutManifest = ${JSON.stringify(manifest, null, 2)} as const\n\n` +
      `export default cutouts\n`,
  )

  const total = Object.values(merged).reduce((s, p) => s + (p.bytes ?? 0), 0)
  console.log(
    `\n✓ ${Object.keys(products).length} prodotto/i → ${manifestPath} + ${tsPath}  (${kb(total)} in manifesto)`,
  )
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
