#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// compilazione-parallela.mjs: quanto resta ferma la pagina mentre la scena compila, con e senza
// la compilazione in parallelo (src/canvas/compilazioneParallela.ts), e se l'IBL sopravvive.
//
// Perché esiste. Su un iPhone col ripiego WebGL2 la compilazione è il costo del caricamento:
// SILKET, 24 set 2026, 157 programmi = ~30 s di pagina ferma. Il kit ha portato la cura il 21 ott
// 2026, e la cura si vede solo misurando il MAIN THREAD durante il caricamento: i gate di stato e di
// pixel guardano la scena finita, e a scena finita i due modi sono identici.
//
// Che cosa misura, giro per giro (WebKit a taglia iPhone 15: niente WebGPU in playwright, quindi il
// ripiego WebGL2; contesto nuovo a ogni giro, modi alternati perché il carico della macchina pesi
// su tutti e due allo stesso modo):
//  - **attese di compilazione**: il tempo passato dentro `getProgramParameter`, la domanda con cui
//    three chiede al processo GPU se un programma è pronto. In modo sincrono è `LINK_STATUS`, e lì la
//    pagina aspetta la compilazione; in parallelo è `COMPLETION_STATUS_KHR`, che in WebKit aspetta
//    a sua volta dietro i link in volo (per questo il tetto `IN_VOLO_MAX`). È l'attribuzione;
//  - **fotogrammi lunghi**: gli intervalli fra due rAF sopra 50 ms (WebKit non ha l'API dei long
//    task), dalla nascita del contesto WebGL2 a 2 s dopo la rivelazione: il più lungo, quanti, e il
//    tempo bloccato (somma della parte oltre i 50 ms). Contiene anche ciò che non è compilazione
//    (la costruzione dei nodi in JS, la decodifica dell'HDRI, React), uguale nei due modi;
//  - **rivelazione**: quando la tela si mostra e perché (fotogramma completo o paracadute).
// Un giro vale solo se ha visto ciò che dice: motore WebGL2, compilazione `accesa` (parallela) o
// `spenta` (`?sincrono`), rivelazione per fotogramma completo, almeno un programma, nessun errore.
//
// Due serie. La **pagina** è la scala vera del kit: 6 programmi al caricamento, che sul Mac a cache
// calda costano ~30 ms, troppo poco per spostare i fotogrammi lunghi (21 ott 2026: attese 31 → 8 ms,
// fotogrammi lunghi uguali). Il **carico** (`?lab=compilazione`, 48 programmi distinti più il quad di
// uscita) con un `sale` nuovo a ogni visita: shader mai visti, cache fredda, ~100 ms a programma sul
// Mac, dello stesso ordine dell'iPhone di SILKET (157 programmi, ~30 s). È la prima visita da un
// telefono, e lì il guadagno si vede nei fotogrammi lunghi: il gate chiede che in parallelo il più
// lungo sia almeno `GUADAGNO_MIN` volte più corto che in modo sincrono (21 ott 2026: 174 ms contro
// 5,19 s, la tabella è in compilazioneParallela.ts).
//
// IBL, il controllo che SILKET non poteva avere (non ha un ambiente). three genera il PMREM
// dell'HDRI una volta sola con render suoi: se quei render saltassero i loro oggetti, l'ambiente
// resterebbe nero per sempre. La cura lascia in parallelo solo la scena presentata, e Stage avvisa
// in console per ogni materiale saltato FUORI dalla scena: in nessun giro deve comparire.
// GATE-NEGATIVO, dentro ogni corsa: `?compilazione=tutta` (il comportamento di SILKET alla lettera)
// DEVE far saltare un materiale `PMREM_*`. Visto il 21 ott 2026 sulla demo: saltano
// `outputColorTransform`, `PMREM_equirect` e `PMREM_ggx`; con la cura, niente. Se il negativo
// smette di sbagliare, il canale è cieco e il gate esce 1.
// Perché niente pixel: su una sfera a specchio sotto l'HDRI (una prova del 21 ott 2026) l'ambiente
// usciva nero a caso anche sul codice PRIMA della cura (2 visite su 4, WebKit a taglia iPhone). Era un
// altro difetto, trovato il 22 ott 2026: l'HDRI smaltito dallo StrictMode a PMREM già nato, che three
// non rifà più (src/canvas/pmremRigenerato.ts). I pixel dell'IBL li guarda ora `npm run qa:ibl`.
//
// Uso:
//   npm run qa:parallela                       # dev server del kit, 4 giri per modo e per serie
//   node scripts/compilazione-parallela.mjs <url> --giri=6 [--serie=pagina|carico]
//   (sulla build: npm run build, poi vite preview e l'indirizzo; `?involo=N` nell'indirizzo prova
//   un altro tetto ai link in volo)
// ─────────────────────────────────────────────────────────────────────────────
import { webkit, devices } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { loadavg } from 'node:os'
import { percorsoBrowser } from './_browser.mjs'

const argv = process.argv.slice(2)
const base = argv.filter((a) => a.startsWith('http')).at(-1) ?? 'http://127.0.0.1:5199/'
const opzione = (nome, def) => Number(argv.find((a) => a.startsWith(`--${nome}=`))?.split('=')[1] ?? def)
const GIRI = opzione('giri', 4)
const LUNGO_MS = 50
const CODA_MS = 2000 // dopo la rivelazione: i primi fotogrammi della scena intera contano ancora
const ATTESA_MAX_MS = 60000
// le domande al processo GPU più lunghe di così finiscono nel dettaglio del rapporto
const DOMANDA_LENTA_MS = 20
// sul carico a freddo, quante volte più corto deve essere il fotogramma più lungo in parallelo: il
// 21 ott 2026 era trenta volte; quattro lascia margine al carico della macchina e non a un ritorno
// della coda (senza tetto il rapporto era tre)
const GUADAGNO_MIN = 4

/** Iniettata prima di ogni script della pagina (serializzata: le costanti arrivano in `lenta`). */
function sonda({ lenta }) {
  const s = (window.__parallela = {
    contesto: -1,
    intervalli: [],
    domande: 0,
    msDomande: 0,
    maxDomanda: 0,
    perNome: {},
    lente: [],
    link: [],
    log: [],
  })
  for (const livello of ['info', 'warn']) {
    const orig = console[livello]
    console[livello] = function (...a) {
      const t = a.map(String).join(' ')
      if (t.startsWith('[kit]')) s.log.push([Math.round(performance.now()), t])
      return orig.apply(this, a)
    }
  }
  let ultimo = performance.now()
  const passo = () => {
    const ora = performance.now()
    if (ora - ultimo > 50) s.intervalli.push([Math.round(ora), Math.round(ora - ultimo)])
    ultimo = ora
    requestAnimationFrame(passo)
  }
  requestAnimationFrame(passo)
  const tela = window.HTMLCanvasElement?.prototype
  if (tela) {
    const getContext = tela.getContext
    tela.getContext = function (tipo, ...resto) {
      const ctx = getContext.call(this, tipo, ...resto)
      if (ctx && tipo === 'webgl2' && s.contesto < 0) s.contesto = performance.now()
      return ctx
    }
  }
  const gl2 = window.WebGL2RenderingContext?.prototype
  if (!gl2) return
  // quale domanda: LINK_STATUS (0x8B82) aspetta la compilazione, COMPLETION_STATUS_KHR (0x91B1) no
  const NOMI = { 0x8b82: 'LINK_STATUS', 0x91b1: 'COMPLETION_STATUS_KHR' }
  const domanda = gl2.getProgramParameter
  gl2.getProgramParameter = function (programma, nome) {
    const inizio = performance.now()
    const v = domanda.call(this, programma, nome)
    const d = performance.now() - inizio
    s.domande++
    s.msDomande += d
    if (d > s.maxDomanda) s.maxDomanda = d
    const chiave = NOMI[nome] ?? `0x${nome.toString(16)}`
    s.perNome[chiave] = (s.perNome[chiave] ?? 0) + d
    if (d > lenta && s.lente.length < 40) s.lente.push([Math.round(inizio), Math.round(d), chiave, s.link.length])
    return v
  }
  const link = gl2.linkProgram
  gl2.linkProgram = function (...a) {
    s.link.push(Math.round(performance.now()))
    return link.apply(this, a)
  }
}

const browser = await webkit.launch({ headless: true, executablePath: percorsoBrowser('webkit') })

const indirizzo = (query) => {
  const u = new URL(base)
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v)
  return u.toString()
}

const dalLog = (log, chiave) => log.find(([, t]) => t.includes(chiave))
const mediana = (xs) => {
  const v = [...xs].sort((a, b) => a - b)
  if (!v.length) return NaN
  return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2
}


/** Una visita: apre `url`, aspetta la rivelazione (e la coda), raccoglie sonda, console, errori. */
async function visita(url) {
  const contesto = await browser.newContext({ ...devices['iPhone 15'] })
  const page = await contesto.newPage()
  const errori = []
  let invalidi = 0
  page.on('console', (m) => {
    const t = m.text()
    if (t.includes('INVALID_OPERATION')) invalidi++
    if (m.type() === 'error' && !t.startsWith('Failed to load resource')) errori.push(t.slice(0, 200))
  })
  page.on('pageerror', (e) => errori.push(e.message.slice(0, 200)))
  await page.addInitScript(sonda, { lenta: DOMANDA_LENTA_MS })
  await page.goto(url, { waitUntil: 'commit', timeout: 60000 })
  // la rivelazione, o il paracadute: dopo 10 s dalla nascita del renderer c'è comunque
  await page
    .waitForFunction(() => window.__parallela?.log.some(([, t]) => t.includes('tela rivelata')), null, { timeout: ATTESA_MAX_MS })
    .catch(() => errori.push(`nessuna rivelazione entro ${ATTESA_MAX_MS / 1000} s`))
  await page.waitForTimeout(CODA_MS)
  const s = await page.evaluate(() => window.__parallela)
  await contesto.close()

  const backend = dalLog(s.log, 'renderer backend:')?.[1].split('renderer backend:')[1].trim() ?? '?'
  const compilazione = dalLog(s.log, 'compilazione WebGL2:')?.[1].split('compilazione WebGL2:')[1].trim().split(' ')[0] ?? '?'
  const riga = dalLog(s.log, 'tela rivelata')
  const rivelata = riga ? riga[0] : -1
  const motivo = riga ? (riga[1].includes('fotogramma completo') ? 'completo' : 'paracadute') : 'mai'
  const msRivelazione = riga ? Number(/tela rivelata a (\d+) ms/.exec(riga[1])?.[1] ?? NaN) : NaN
  const fuoriScena = s.log.filter(([, t]) => t.includes('fuori dalla scena presentata')).map(([, t]) => /«([^»]*)»/.exec(t)?.[1] ?? t)
  const laboratorio = dalLog(s.log, '[kit] laboratorio compilazione')?.[1] ?? null
  const fine = rivelata >= 0 ? rivelata + CODA_MS : Infinity
  const finestra = s.intervalli.filter(([t]) => s.contesto >= 0 && t >= s.contesto && t <= fine)
  const lunghi = finestra.filter(([, d]) => d > LUNGO_MS)
  // le domande lente, dal contesto: quando, quanto, quale, dopo quanti link
  const lente = s.lente.map(([t, d, nome, link]) => ({ dalContesto: Math.round(t - s.contesto), ms: d, domanda: nome, linkPrima: link }))
  return {
    url, backend, compilazione, motivo, msRivelazione,
    programmi: s.link.length,
    msAttese: Math.round(s.msDomande),
    // in parallelo LINK_STATUS resta solo per i programmi sincroni di proposito (PMREM, quad di
    // uscita) e per quelli già pronti; COMPLETION_STATUS_KHR sono le domande «hai finito?»
    msLinkStatus: Math.round(s.perNome.LINK_STATUS ?? 0),
    msCompletamento: Math.round(s.perNome.COMPLETION_STATUS_KHR ?? 0),
    maxAttesa: Math.round(s.maxDomanda),
    domande: s.domande,
    maxFotogramma: lunghi.reduce((m, [, d]) => Math.max(m, d), 0),
    fotogrammiLunghi: lunghi.length,
    msBloccati: lunghi.reduce((somma, [, d]) => somma + d - LUNGO_MS, 0),
    lente, fuoriScena, laboratorio, invalidi, errori,
    // la cronologia, dal contesto WebGL2: dove cadono i fotogrammi lunghi rispetto ai link
    cronologia: {
      link: s.link.map((t) => Math.round(t - s.contesto)),
      lunghi: lunghi.map(([t, d]) => [Math.round(t - d - s.contesto), d]),
      rivelata: rivelata >= 0 ? Math.round(rivelata - s.contesto) : null,
    },
  }
}

// Due serie. La pagina è la scala vera del kit (6 programmi al caricamento della demo, 21 ott 2026);
// il laboratorio di carico (src/lab/CompilazioneLab.tsx, 48 programmi distinti) è la scala a cui
// la differenza si vede anche nei fotogrammi lunghi del Mac, dove compilare costa poco. Il carico
// ha un `sale` diverso a ogni visita: sorgenti mai visti, cioè la cache degli shader vuota, come la
// prima visita da un telefono. Senza, dalla seconda visita il Mac li ha in cache (21 ott 2026: il
// primo giro a freddo in parallelo aveva un LINK_STATUS da 1,76 s, i successivi nessuna attesa).
const SERIE = [
  { nome: 'pagina', query: () => ({}) },
  { nome: 'carico', query: () => ({ lab: 'compilazione', sale: String(Math.floor(Math.random() * 1e9)) }) },
].filter((s) => !argv.some((a) => a.startsWith('--serie=')) || argv.includes(`--serie=${s.nome}`))

const fallimenti = []
const giri = []
const caricoPrima = loadavg()[0]
try {
  for (const serie of SERIE) {
    for (let i = 0; i < GIRI; i++) {
      // alternati, e l'ordine si scambia a ogni coppia: nessun modo parte sempre a cache più calda
      const ordine = i % 2 ? ['sincrona', 'parallela'] : ['parallela', 'sincrona']
      for (const modo of ordine) {
        const e = await visita(indirizzo(modo === 'sincrona' ? { ...serie.query(), sincrono: '' } : serie.query()))
        giri.push({ serie: serie.nome, modo, giro: i + 1, carico: Math.round(loadavg()[0]), ...e })
        process.stdout.write(`  ${serie.nome} ${modo} ${i + 1}/${GIRI}: attese ${e.msAttese} ms, fotogramma più lungo ${e.maxFotogramma} ms, rivelata a ${e.msRivelazione} ms\n`)
      }
    }
  }
  // il negativo: il comportamento di SILKET alla lettera deve far saltare il PMREM, e farlo vedere
  const neg = await visita(indirizzo({ compilazione: 'tutta' }))
  giri.push({ serie: 'pagina', modo: 'negativo', giro: 1, carico: Math.round(loadavg()[0]), ...neg })

  // validità dei giri
  for (const g of giri) {
    const nome = `${g.serie} ${g.modo} giro ${g.giro}`
    const attesa = g.modo === 'sincrona' ? 'spenta' : 'accesa'
    if (g.backend !== 'WebGL2') fallimenti.push(`${nome}: motore «${g.backend}», la misura è del ripiego WebGL2`)
    if (g.compilazione !== attesa) fallimenti.push(`${nome}: compilazione «${g.compilazione}», attesa «${attesa}»`)
    if (g.motivo !== 'completo') fallimenti.push(`${nome}: tela rivelata per «${g.motivo}», non per fotogramma completo`)
    if (!g.programmi) fallimenti.push(`${nome}: nessun programma linkato, la sonda non ha visto la scena`)
    if (g.serie === 'carico' && !g.laboratorio) fallimenti.push(`${nome}: la pagina ?lab=compilazione non è il laboratorio (manca src/lab/CompilazioneLab.tsx?)`)
    if (g.invalidi) fallimenti.push(`${nome}: ${g.invalidi} INVALID_OPERATION in console`)
    for (const e of g.errori) fallimenti.push(`${nome}: ${e}`)
    if (g.modo !== 'negativo' && g.fuoriScena.length) {
      fallimenti.push(`${nome}: saltati fuori dalla scena presentata ${g.fuoriScena.join(', ')}: un PMREM o un'ombra su richiesta restano incompleti`)
    }
  }
  if (!neg.fuoriScena.some((t) => t.startsWith('PMREM_'))) {
    fallimenti.push(`negativo (?compilazione=tutta): nessun materiale PMREM_ fra i saltati fuori scena (visti: ${neg.fuoriScena.join(', ') || 'nessuno'}): il canale è cieco`)
  }
} finally {
  await browser.close()
}

const riassunto = {}
for (const serie of SERIE) {
  riassunto[serie.nome] = {}
  for (const modo of ['parallela', 'sincrona']) {
    const g = giri.filter((x) => x.serie === serie.nome && x.modo === modo)
    riassunto[serie.nome][modo] = {
      giri: g.length,
      programmi: mediana(g.map((x) => x.programmi)),
      msAttese: mediana(g.map((x) => x.msAttese)),
      msLinkStatus: mediana(g.map((x) => x.msLinkStatus)),
      msCompletamento: mediana(g.map((x) => x.msCompletamento)),
      maxAttesa: mediana(g.map((x) => x.maxAttesa)),
      maxFotogramma: mediana(g.map((x) => x.maxFotogramma)),
      fotogrammiLunghi: mediana(g.map((x) => x.fotogrammiLunghi)),
      msBloccati: mediana(g.map((x) => x.msBloccati)),
      msRivelazione: mediana(g.map((x) => x.msRivelazione)),
    }
  }
  // Il guadagno che la cura promette è sull'attribuzione: in parallelo la pagina non aspetta più la
  // compilazione. Se non si vede nemmeno qui, o la cura non si è accesa o la misura è cieca.
  const { parallela: p, sincrona: s } = riassunto[serie.nome]
  if (!(p.msAttese < s.msAttese)) {
    fallimenti.push(`${serie.nome}: attese di compilazione, mediana ${p.msAttese} ms in parallelo contro ${s.msAttese} ms sincrona, nessun guadagno`)
  }
  // A cache fredda il guadagno deve vedersi dove lo sente chi guarda: la pagina che si ferma.
  if (serie.nome === 'carico' && !(p.maxFotogramma * GUADAGNO_MIN <= s.maxFotogramma)) {
    fallimenti.push(`carico: fotogramma più lungo ${p.maxFotogramma} ms in parallelo contro ${s.maxFotogramma} ms sincrona, meno di ${GUADAGNO_MIN} volte più corto: la coda dei link è tornata (tetto?) o la cura non si accende`)
  }
}

const caricoDopo = loadavg()[0]
console.log(`\n# Compilazione in parallelo: WebKit a taglia iPhone 15 (WebGL2) · ${base}`)
console.log(`carico della macchina (media 1 min): ${caricoPrima.toFixed(1)} prima, ${caricoDopo.toFixed(1)} dopo · ${GIRI} giri per modo e per serie, alternati\n`)
console.log('| serie | mediana | programmi | attese di compilazione (ms) | di cui LINK_STATUS / COMPLETION (ms) | attesa più lunga (ms) | fotogramma più lungo (ms) | fotogrammi > 50 ms | tempo bloccato (ms) | tela rivelata a (ms) |')
console.log('|---|---|---|---|---|---|---|---|---|---|')
for (const [serie, modi] of Object.entries(riassunto)) {
  for (const [modo, r] of Object.entries(modi)) {
    console.log(`| ${serie} | ${modo} | ${r.programmi} | ${r.msAttese} | ${r.msLinkStatus} / ${r.msCompletamento} | ${r.maxAttesa} | ${r.maxFotogramma} | ${r.fotogrammiLunghi} | ${r.msBloccati} | ${r.msRivelazione} |`)
  }
}
console.log('\n| giro | carico | compilazione | programmi | attese (ms) | LINK / COMPL. (ms) | attesa più lunga (ms) | fotogramma più lungo (ms) | > 50 ms | bloccato (ms) | rivelata a (ms) |')
console.log('|---|---|---|---|---|---|---|---|---|---|---|')
for (const g of giri) {
  console.log(`| ${g.serie} ${g.modo} ${g.giro} | ${g.carico} | ${g.compilazione} | ${g.programmi} | ${g.msAttese} | ${g.msLinkStatus} / ${g.msCompletamento} | ${g.maxAttesa} | ${g.maxFotogramma} | ${g.fotogrammiLunghi} | ${g.msBloccati} | ${g.msRivelazione} (${g.motivo}) |`)
}
for (const g of giri) {
  const peggiori = [...g.lente].sort((a, b) => b.ms - a.ms).slice(0, 3)
  if (peggiori.length) {
    console.log(`  · ${g.serie} ${g.modo} ${g.giro}, domande più lente: ${peggiori.map((l) => `${l.domanda} ${l.ms} ms a ${l.dalContesto} ms (dopo ${l.linkPrima} link)`).join('; ')}`)
  }
}
for (const g of giri.filter((x) => x.fuoriScena.length)) console.log(`  · ${g.serie} ${g.modo}: saltati fuori scena ${g.fuoriScena.join(', ')}`)
mkdirSync('qa', { recursive: true })
writeFileSync('qa/compilazione-parallela.json', JSON.stringify({ base, giri: GIRI, carico: { prima: caricoPrima, dopo: caricoDopo }, riassunto, dettaglio: giri }, null, 2) + '\n')
console.log('\n→ qa/compilazione-parallela.json')
if (fallimenti.length) {
  console.log(`\n✗ ${fallimenti.length} problemi:`)
  for (const f of fallimenti) console.log(`  ✗ ${f}`)
  process.exit(1)
}
console.log('\n✓ in parallelo la pagina non aspetta la compilazione, la tela arriva intera, il PMREM resta sincrono')
