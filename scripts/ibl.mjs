#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// ibl.mjs: il gate dell'IBL nero (three r185: il PMREM di un HDRI smaltito non si rifà più).
//
// Perché esiste. Il 21 ott 2026, portando la compilazione in parallelo nel kit, una sfera a specchio
// sotto l'HDRI del kit usciva o accesa o nera piena, a caso, in WebKit a taglia iPhone: il canale a
// pixel di `qa:parallela` era stato tolto per questo. La causa (22 ott 2026, src/canvas/
// pmremRigenerato.ts): drei smaltisce l'HDRI allo smontaggio di `<Environment files>`, three smaltisce
// con lui il PMREM, e il PMREMNode che lo campiona non lo rifà mai più. In produzione basta smontare e
// rimontare l'ambiente; in sviluppo lo fa lo StrictMode subito dopo il montaggio, e vince la corsa
// solo se R3F ha già disegnato un fotogramma. Nessun gate lo vedeva: lo stato non tocca la GPU, il
// pixel della demo (forma scura, metalness 0.1) quasi non cambia, il tempo per fotogramma nemmeno.
//
// Che cosa misura, visita per visita (contesto nuovo, laboratorio ?lab=ibl, src/lab/IblLab.tsx):
//  - la luminanza media di un quadrato al centro (la sfera a specchio, che vive solo di IBL) e di
//    uno in basso a sinistra (il fondale senza luce, il testimone della tela; in alto c'è l'HUD);
//  - la cronaca del laboratorio, in ordine: PMREM generati e smaltiti, HDRI smaltito;
//  - che cosa campiona il PMREMNode a fine visita: il suo PMREM vivo, uno smaltito, o la texture
//    di ripiego.
// Un giro vale solo se ha visto ciò che dice: il laboratorio, il motore atteso, la cura nello stato
// atteso (dal log di Stage), il fondale acceso (spento è la tela a mancare, non l'IBL), almeno un
// PMREM nato, nessun errore. Altrimenti esce 1 dicendo che cosa non ha visto.
//
// Protocollo, per motore (WebKit a taglia iPhone 15 = il ripiego WebGL2 degli iPhone fino a iOS 18;
// Chromium = WebGPU; il difetto è nei nodi di three, quindi su tutti e due):
//  1. NEGATIVO, `ordine=rimonta&pmrem=nudo`: l'ambiente smontato e rimontato dopo il primo PMREM,
//     cura spenta. DEVE uscire nero, col PMREM smaltito e mai rifatto. Se esce acceso, o three ha
//     corretto il difetto (e la cura si toglie) o il canale è cieco: exit 1 in entrambi i casi;
//  2. `ordine=rimonta` con la cura: acceso, col PMREM rinato dopo lo smaltimento;
//  3. la visita naturale, `--giri` volte (almeno 8), solo su WebKit: zero nere. Nel dev lo StrictMode
//     smaltisce l'HDRI subito dopo il montaggio: dove il PMREM era già nato, la cura deve averlo
//     rifatto. Il rapporto conta in quante visite la corsa c'è stata.
// Perché il negativo è la rimonta e non la visita naturale senza cura: quella è una corsa, il 22 ott
// 2026 nera in WebKit 16 volte su 28 e in Chromium 0 su 8, e un negativo a caso fa un gate a caso.
// `--anche-nudo` ripete la serie naturale senza cura e ne conta le nere, senza giudicarle.
//
// Uso:
//   npm run qa:ibl                                     # dev server del kit, WebKit e Chromium
//   node scripts/ibl.mjs <url> --giri=12 [--motori=webkit] [--anche-nudo]
//   (sulla build, `vite preview`: la serie naturale non vede la corsa, che è dello StrictMode;
//   negativo e rimonta valgono uguale)
// ─────────────────────────────────────────────────────────────────────────────
import { webkit, chromium, devices } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { percorsoBrowser } from './_browser.mjs'

const argv = process.argv.slice(2)
const base = argv.filter((a) => a.startsWith('http')).at(-1) ?? 'http://127.0.0.1:5199/'
const valore = (nome, def) => argv.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3) ?? def
const GIRI = Number(valore('giri', 8))
const MOTORI = valore('motori', 'webkit,chromium').split(',').filter(Boolean)
const ANCHE_NUDO = argv.includes('--anche-nudo')
// le soglie, dalle misure del 22 ott 2026: sfera accesa 38,6 (WebKit) e 39,1 (Chromium), nera 0,0;
// fondale 141. Fra nera e accesa non c'è niente: un valore in mezzo è un'altra cosa, e fallisce
const SFERA_NERA = 5
const SFERA_ACCESA = 20
const FONDALE_ACCESO = 60
// dopo la riga del laboratorio (naturale) o dopo il rimontaggio: il PMREM nasce entro ~100 ms dal
// primo fotogramma, e la corsa dello StrictMode si chiude nei 30 ms dopo
const ATTESA_MS = 3000
const ATTESA_RIMONTA_MS = 1500

if (!(GIRI >= 8)) {
  console.error(`✗ --giri=${GIRI}: la serie naturale vuole almeno 8 visite (una corsa che esce una volta su due ne mostra una in 8 quasi sempre)`)
  process.exit(2)
}

/** PNG a 8 bit, RGB o RGBA, non interlacciato: quelli che scatta playwright. */
function decodificaPng(buf) {
  let pos = 8
  let larghezza = 0
  let altezza = 0
  let tipo = 0
  const idat = []
  while (pos < buf.length) {
    const lung = buf.readUInt32BE(pos)
    const nome = buf.toString('ascii', pos + 4, pos + 8)
    const dati = buf.subarray(pos + 8, pos + 8 + lung)
    if (nome === 'IHDR') {
      larghezza = dati.readUInt32BE(0)
      altezza = dati.readUInt32BE(4)
      if (dati[8] !== 8 || dati[12] !== 0) throw new Error('PNG non previsto (profondità o interlacciamento)')
      tipo = dati[9]
    } else if (nome === 'IDAT') idat.push(dati)
    else if (nome === 'IEND') break
    pos += 12 + lung
  }
  const bpp = tipo === 6 ? 4 : tipo === 2 ? 3 : 0
  if (!bpp) throw new Error(`PNG di tipo colore ${tipo} non previsto`)
  const grezzo = inflateSync(Buffer.concat(idat))
  const passo = larghezza * bpp
  const px = Buffer.alloc(altezza * passo)
  for (let y = 0; y < altezza; y++) {
    const filtro = grezzo[y * (passo + 1)]
    const src = grezzo.subarray(y * (passo + 1) + 1, (y + 1) * (passo + 1))
    const riga = px.subarray(y * passo, (y + 1) * passo)
    const sopra = y ? px.subarray((y - 1) * passo, y * passo) : null
    for (let x = 0; x < passo; x++) {
      const a = x >= bpp ? riga[x - bpp] : 0
      const b = sopra ? sopra[x] : 0
      const c = sopra && x >= bpp ? sopra[x - bpp] : 0
      let v = src[x]
      if (filtro === 1) v += a
      else if (filtro === 2) v += b
      else if (filtro === 3) v += (a + b) >> 1
      else if (filtro === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      riga[x] = v & 255
    }
  }
  return { bpp, px }
}

/** Luminanza media (Rec. 709, 0-255) di uno scatto. */
function luminanza(png) {
  const { px, bpp } = decodificaPng(png)
  let somma = 0
  for (let i = 0; i < px.length; i += bpp) somma += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]
  return Math.round((somma / (px.length / bpp)) * 10) / 10
}

/** La cronaca del laboratorio: `[kit] ibl: <evento> a <ms> ms`, in ordine di arrivo. */
function cronaca(log) {
  return log
    .map((t) => /^\[kit\] ibl: (.*) a (\d+) ms$/.exec(t))
    .filter(Boolean)
    .map(([, evento, ms]) => ({ evento, ms: Number(ms) }))
}

const MOTORE = {
  webkit: { tipo: webkit, atteso: 'WebGL2', contesto: () => ({ ...devices['iPhone 15'] }), args: [] },
  // la taglia dell'iPhone senza emularne il motore: qui serve WebGPU, non WebKit
  chromium: { tipo: chromium, atteso: 'WebGPU', contesto: () => ({ viewport: { width: 393, height: 659 } }), args: ['--enable-unsafe-webgpu', '--use-angle=metal', '--enable-gpu'] },
}

async function visita(browser, motore, query) {
  const u = new URL(base)
  u.searchParams.set('lab', 'ibl')
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v)
  const contesto = await browser.newContext(MOTORE[motore].contesto())
  const page = await contesto.newPage()
  const log = []
  const errori = []
  page.on('console', (m) => {
    const t = m.text()
    if (t.startsWith('[kit]')) log.push(t)
    if (m.type() === 'error' && !t.startsWith('Failed to load resource')) errori.push(t.slice(0, 200))
  })
  page.on('pageerror', (e) => errori.push(e.message.slice(0, 200)))
  const attendi = async (pezzo, ms) => {
    const fine = Date.now() + ms
    while (Date.now() < fine && !log.some((t) => t.includes(pezzo))) await page.waitForTimeout(100)
    return log.some((t) => t.includes(pezzo))
  }
  await page.goto(u.toString(), { waitUntil: 'commit', timeout: 60000 })
  let sfera = NaN
  let fondale = NaN
  let stato = null
  if (!(await attendi('[kit] laboratorio ibl', 30000))) errori.push('la pagina non ha mai detto «laboratorio ibl»: non è il laboratorio (manca src/lab/IblLab.tsx?)')
  else if (query.ordine === 'rimonta' && !(await attendi('ambiente rimontato', 30000))) errori.push("l'ambiente non è mai stato rimontato")
  else {
    await page.waitForTimeout(query.ordine === 'rimonta' ? ATTESA_RIMONTA_MS : ATTESA_MS)
    const vp = page.viewportSize()
    sfera = luminanza(await page.screenshot({ scale: 'css', clip: { x: vp.width / 2 - 20, y: vp.height / 2 - 20, width: 40, height: 40 } }))
    fondale = luminanza(await page.screenshot({ scale: 'css', clip: { x: 8, y: vp.height - 38, width: 30, height: 30 } }))
    stato = await page.evaluate(() => window.__iblLab?.stato() ?? null)
  }
  await contesto.close()
  const dalLog = (chiave) => log.find((t) => t.startsWith(chiave))?.slice(chiave.length).trim() ?? '?'
  const eventi = cronaca(log)
  const generati = eventi.filter((e) => e.evento.startsWith('pmrem generato'))
  const smaltiti = eventi.filter((e) => e.evento === 'pmrem smaltito')
  const ultimoSmaltito = smaltiti.at(-1)?.ms ?? -1
  const smontato = eventi.find((e) => e.evento === 'ambiente smontato')?.ms ?? Infinity
  return {
    motore, query, sfera, fondale, errori,
    backend: dalLog('[kit] renderer backend:'),
    cura: dalLog('[kit] pmrem:'),
    nodi: stato?.nodi ?? [],
    generati: generati.length,
    smaltiti: smaltiti.length,
    // rinato: un PMREM generato DOPO l'ultimo smaltito (la cura al lavoro)
    rinato: smaltiti.length > 0 && generati.some((e) => e.ms >= ultimoSmaltito),
    // la corsa dello StrictMode: l'HDRI smaltito a PMREM già nato, prima di ogni smontaggio voluto
    corsa: generati.length > 0 && eventi.some((e) => e.evento === 'hdri smaltito' && e.ms >= generati[0].ms && e.ms < smontato),
    rivelata: log.some((t) => t.includes('tela rivelata')),
    cronaca: eventi.map((e) => `${e.evento} ${e.ms}`).join(' · '),
  }
}

const fallimenti = []
const visite = []
const nome = (v) => `${v.motore} ${v.serie}${v.giro ? ` ${v.giro}` : ''}`

/** Ciò che ogni visita deve aver visto per valere, qualunque cosa misuri. */
function valida(v, curaAttesa) {
  const n = nome(v)
  for (const e of v.errori) fallimenti.push(`${n}: ${e}`)
  if (v.errori.length) return false
  let ok = true
  const manca = (cosa) => {
    fallimenti.push(`${n}: ${cosa}`)
    ok = false
  }
  if (v.backend !== MOTORE[v.motore].atteso) manca(`motore «${v.backend}», atteso ${MOTORE[v.motore].atteso}`)
  if (v.cura !== curaAttesa) manca(`cura «${v.cura}», attesa «${curaAttesa}» (dal log di Stage: «[kit] pmrem: …»)`)
  if (!(v.fondale >= FONDALE_ACCESO)) manca(`fondale a ${v.fondale} (< ${FONDALE_ACCESO}): è la tela a non disegnare, la sfera non dice niente sull'IBL`)
  if (!v.generati) manca('nessun PMREM generato: la sonda del laboratorio non ha visto three al lavoro')
  if (!v.rivelata) manca('la tela non è mai stata rivelata')
  return ok
}

try {
  for (const motore of MOTORI) {
    if (!MOTORE[motore]) throw new Error(`motore «${motore}» sconosciuto (webkit | chromium)`)
    const browser = await MOTORE[motore].tipo.launch({ headless: true, executablePath: percorsoBrowser(motore), args: MOTORE[motore].args })
    try {
      // 1. il negativo: senza cura, l'ambiente rimontato DEVE restare nero, per la ragione giusta
      const neg = { serie: 'negativo', ...(await visita(browser, motore, { ordine: 'rimonta', pmrem: 'nudo' })) }
      visite.push(neg)
      if (valida(neg, 'spenta')) {
        if (!(neg.sfera < SFERA_NERA)) {
          fallimenti.push(`${nome(neg)}: sfera a ${neg.sfera} senza cura dopo la rimonta. Se il PMREM è rinato da sé (cronaca: ${neg.cronaca}), three ha corretto il difetto e pmremRigenerato.ts si toglie; altrimenti il canale è cieco`)
        } else if (!(neg.smaltiti > 0 && !neg.rinato && neg.nodi.includes('pmrem smaltito'))) {
          fallimenti.push(`${nome(neg)}: nera, ma non per il PMREM smaltito (smaltiti ${neg.smaltiti}, rinato ${neg.rinato}, nodi ${neg.nodi.join(', ') || 'nessuno'}): il negativo muore sull'assert sbagliato`)
        }
      }
      // 2. la rimonta con la cura: accesa, col PMREM rifatto dopo lo smaltimento
      const pos = { serie: 'rimonta', ...(await visita(browser, motore, { ordine: 'rimonta' })) }
      visite.push(pos)
      if (valida(pos, 'accesa')) {
        if (!(pos.sfera >= SFERA_ACCESA)) fallimenti.push(`${nome(pos)}: sfera a ${pos.sfera} con la cura dopo la rimonta (cronaca: ${pos.cronaca})`)
        else if (!pos.rinato) fallimenti.push(`${nome(pos)}: accesa ma senza un PMREM rinato dopo lo smaltimento: la rimonta non ha provato la cura (cronaca: ${pos.cronaca})`)
        if (pos.nodi.some((s) => s !== 'pmrem vivo')) fallimenti.push(`${nome(pos)}: un PMREMNode campiona «${pos.nodi.join(', ')}»`)
      }
      // 3. la visita naturale, solo dove la corsa si vede (WebKit), con la cura e (a richiesta) senza
      if (motore === 'webkit') {
        const serie = [['naturale', {}, 'accesa']]
        if (ANCHE_NUDO) serie.push(['naturale nuda', { pmrem: 'nudo' }, 'spenta'])
        for (const [nomeSerie, query, cura] of serie) {
          for (let i = 0; i < GIRI; i++) {
            const v = { serie: nomeSerie, giro: i + 1, ...(await visita(browser, motore, query)) }
            visite.push(v)
            process.stdout.write(`  ${nome(v)}/${GIRI}: sfera ${v.sfera}, fondale ${v.fondale}${v.corsa ? ', corsa' : ''}${v.rinato ? ', rinato' : ''}\n`)
            if (!valida(v, cura) || nomeSerie !== 'naturale') continue
            if (!(v.sfera >= SFERA_ACCESA)) fallimenti.push(`${nome(v)}: sfera a ${v.sfera} con la cura (cronaca: ${v.cronaca})`)
          }
        }
      }
    } finally {
      await browser.close()
    }
  }
} catch (e) {
  fallimenti.push(`il gate si è fermato: ${e.message}`)
}

const naturali = visite.filter((v) => v.serie === 'naturale')
const nude = visite.filter((v) => v.serie === 'naturale nuda')
const contaNere = (vs) => vs.filter((v) => v.sfera < SFERA_NERA).length
console.log(`\n# IBL nero: laboratorio ?lab=ibl · ${base}`)
console.log('\n| visita | motore | cura | sfera | fondale | PMREM nati / smaltiti | rinato | corsa | nodi |')
console.log('|---|---|---|---|---|---|---|---|---|')
for (const v of visite) {
  console.log(`| ${v.serie}${v.giro ? ` ${v.giro}` : ''} | ${v.backend} | ${v.cura} | ${v.sfera} | ${v.fondale} | ${v.generati} / ${v.smaltiti} | ${v.rinato ? 'sì' : 'no'} | ${v.corsa ? 'sì' : 'no'} | ${v.nodi.join(', ')} |`)
}
if (naturali.length) {
  console.log(`\nnaturale con la cura: ${contaNere(naturali)} nere su ${naturali.length}; la corsa dello StrictMode (HDRI smaltito a PMREM già nato) in ${naturali.filter((v) => v.corsa).length}`)
}
if (nude.length) console.log(`naturale senza cura (--anche-nudo, solo misura): ${contaNere(nude)} nere su ${nude.length}, corsa in ${nude.filter((v) => v.corsa).length}`)
mkdirSync('qa', { recursive: true })
writeFileSync('qa/ibl.json', JSON.stringify({ base, giri: GIRI, motori: MOTORI, visite }, null, 2) + '\n')
console.log('\n→ qa/ibl.json')
if (fallimenti.length) {
  console.log(`\n✗ ${fallimenti.length} problemi:`)
  for (const f of fallimenti) console.log(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`\n✓ senza cura l'ambiente rimontato resta nero (${MOTORI.join(', ')}); con la cura il PMREM rinasce, e ${naturali.length} visite naturali su ${naturali.length} sono accese`)
