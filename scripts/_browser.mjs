#!/usr/bin/env node
// _browser.mjs: **un fatto, un posto**. Dove sta l'eseguibile del browser che playwright-core guida.
//
// Portato da SILKET (scripts/_browser.mjs, 12 set 2026), dove la revisione cablata a mano in
// diciannove script aveva già lasciato a terra il gate su WebKit: le copie non danno un errore
// quando divergono, danno un gate che non parte. Qui la revisione si LEGGE da
// `node_modules/playwright-core/browsers.json` e il percorso si compone con la convenzione di
// cartelle di playwright (`~/Library/Caches/ms-playwright/<nome>-<rev>/…`).
//
// In più rispetto a SILKET, il ripiego su una revisione VICINA. Misurato il 21 ott 2026 con
// playwright-core 1.62.1, che vuole webkit-2336 (assente in cache): webkit-2359 parte e dà WebGL2
// sulla GPU Apple; webkit-2311, più vecchia, resta APPESA al lancio senza errore e senza
// rispettare il timeout di `launch`. Quindi il ripiego va solo verso revisioni PIÙ NUOVE, e lo si
// dichiara a schermo. Se non ce n'è nessuna, esce 2 col comando che installa quella giusta.
//
// Uso:  import { percorsoBrowser } from './_browser.mjs'
//       const exe = percorsoBrowser('webkit')   // o 'chromium'
// `CHROMIUM_PATH` / `WEBKIT_PATH` sovrascrivono; `PLAYWRIGHT_BROWSERS_PATH` sposta la cache come per
// playwright. Lanciato da solo stampa cosa risolve.
import { createRequire } from 'node:module'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { homedir, platform, release, cpus, arch } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const PACCHETTO = require.resolve('playwright-core/package.json')
const RADICE = dirname(PACCHETTO)

export const versionePlaywright = JSON.parse(readFileSync(PACCHETTO, 'utf8')).version
const BROWSERS = JSON.parse(readFileSync(join(RADICE, 'browsers.json'), 'utf8')).browsers

/** La piattaforma come la calcola playwright, per leggere `revisionOverrides`. Solo macOS. */
function piattaforma() {
  if (process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE) return process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE
  if (platform() !== 'darwin') throw new Error(`_browser.mjs: piattaforma ${platform()} non prevista, i gate del kit girano su macOS`)
  const maggiore = Number(release().split('.')[0])
  const mac = maggiore < 25 ? `mac${maggiore - 9}` : `mac${Math.min(maggiore + 1, 26)}`
  return cpus().some((c) => c.model.includes('Apple')) ? `${mac}-arm64` : mac
}

function cartellaCache() {
  const env = process.env.PLAYWRIGHT_BROWSERS_PATH
  if (env === '0') return join(RADICE, '.local-browsers')
  if (env) return resolve(env)
  return join(homedir(), 'Library', 'Caches', 'ms-playwright')
}

const CODA = {
  chromium: () => [
    arch() === 'arm64' ? 'chrome-mac-arm64' : 'chrome-mac-x64',
    'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing',
  ],
  webkit: () => ['pw_run.sh'],
}

/** Risoluzione pura: non esce, non stampa. */
export function risolviBrowser(nome) {
  if (!CODA[nome]) throw new Error(`_browser.mjs: motore «${nome}» sconosciuto (chromium | webkit)`)
  const variabile = nome === 'chromium' ? 'CHROMIUM_PATH' : 'WEBKIT_PATH'
  if (process.env[variabile]) {
    const percorso = process.env[variabile]
    return { nome, revisione: null, percorso, esiste: existsSync(percorso), ripiego: false }
  }
  const voce = BROWSERS.find((b) => b.name === nome)
  const voluta = Number(voce.revisionOverrides?.[piattaforma()] ?? voce.revision)
  const percorsoDi = (rev) => join(cartellaCache(), `${nome}-${rev}`, ...CODA[nome]())
  if (existsSync(percorsoDi(voluta))) {
    return { nome, revisione: voluta, voluta, percorso: percorsoDi(voluta), esiste: true, ripiego: false }
  }
  // ripiego: la più vicina fra quelle PIÙ NUOVE (le più vecchie possono appendersi al lancio)
  const nuove = existsSync(cartellaCache())
    ? readdirSync(cartellaCache())
        .map((d) => d.match(new RegExp(`^${nome}-(\\d+)$`))?.[1])
        .filter(Boolean)
        .map(Number)
        .filter((rev) => rev > voluta && existsSync(percorsoDi(rev)))
        .sort((a, b) => a - b)
    : []
  if (nuove.length) {
    return { nome, revisione: nuove[0], voluta, percorso: percorsoDi(nuove[0]), esiste: true, ripiego: true }
  }
  return { nome, revisione: voluta, voluta, percorso: percorsoDi(voluta), esiste: false, ripiego: false }
}

/** L'uso normale: il percorso, oppure il messaggio e uscita 2. */
export function percorsoBrowser(nome) {
  const r = risolviBrowser(nome)
  if (!r.esiste) {
    console.error(
      `✗ ${nome}: manca la revisione ${r.voluta ?? '(override)'} (playwright-core ${versionePlaywright} la cerca in ${r.percorso}).\n` +
        `  Installa ESATTAMENTE questa: npx playwright@${versionePlaywright} install ${nome}`,
    )
    process.exit(2)
  }
  if (r.ripiego) {
    console.warn(`⚠ ${nome}: playwright-core ${versionePlaywright} vuole la ${r.voluta}, assente; uso la ${r.revisione} (più nuova)`)
  }
  return r.percorso
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  console.log(`playwright-core ${versionePlaywright} · ${piattaforma()} · cache ${cartellaCache()}`)
  for (const nome of Object.keys(CODA)) {
    const r = risolviBrowser(nome)
    console.log(`${r.esiste ? '✓' : '✗'} ${nome} ${r.revisione ?? '(override)'}${r.ripiego ? ` (ripiego, voluta ${r.voluta})` : ''} → ${r.percorso}`)
  }
}
