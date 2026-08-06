#!/usr/bin/env node
// visual-diff.mjs — il gate visivo che restituisce NUMERI, non immagini.
//
// PERCHÉ. `qa:shoot` produce 15 PNG (5 sezioni × 3 breakpoint). Farli guardare a un modello costa
// circa 1.700 token l'uno (≈ larghezza×altezza/750): ~25.000 token per giro, ripetuti a ogni fix.
// Qui ogni scatto diventa una riga — «gradient-1440  0.31%  ≤2.00%  PASS» — e l'immagine risale al
// modello SOLO quando serve davvero: quando supera il budget, o quando la domanda è estetica e non
// di regressione. In quel caso scriviamo anche il diff evidenziato, così si apre UN file, non
// quindici.
//
// Uso:
//   npm run qa:shoot && npm run qa:diff     confronta con la baseline, esce 1 se qualcosa sfora
//   npm run qa:bless                        promuove gli scatti correnti a nuova baseline
//
// La baseline (qa/baseline/) si committa: è la memoria di come deve apparire il sito.
import { compare } from 'odiff-bin'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const SHOTS = 'qa/shots'
const BASELINE = 'qa/baseline'
const DIFFS = 'qa/diff'
const BUDGET_FILE = 'qa/diff-budget.json'
const bless = process.argv.includes('--bless')

const shots = existsSync(SHOTS)
  ? readdirSync(SHOTS).filter((f) => f.endsWith('.png')).sort()
  : []

if (shots.length === 0) {
  console.error(`nessuno screenshot in ${SHOTS}/ — lancia prima \`npm run qa:shoot\``)
  process.exit(1)
}

if (bless) {
  // Azzera PRIMA di copiare. Una baseline che accumula scatti di sezioni rimosse è la versione
  // lenta dello stesso difetto che shoot.mjs evita ripulendo qa/shots: file morti che restano
  // nel repo e che nessuno saprà più se sono ancora la verità.
  rmSync(BASELINE, { recursive: true, force: true })
  mkdirSync(BASELINE, { recursive: true })
  for (const f of shots) copyFileSync(join(SHOTS, f), join(BASELINE, f))
  rmSync(DIFFS, { recursive: true, force: true })
  console.log(`✓ baseline aggiornata: ${shots.length} scatti in ${BASELINE}/`)
  console.log('  committala — è la memoria di come deve apparire il sito.')
  process.exit(0)
}

// Budget per scatto, in PERCENTUALE di pixel diversi. Una scena 3D animata non è deterministica
// al pixel: il budget non è una tolleranza pigra, è il rumore di fondo MISURATO del rendering.
// Vedi qa/diff-budget.json per come sono stati ricavati.
const budget = existsSync(BUDGET_FILE)
  ? JSON.parse(readFileSync(BUDGET_FILE, 'utf8'))
  : { default: 1, perShot: {} }

mkdirSync(DIFFS, { recursive: true })

let failed = 0
let missing = 0
const rows = []

for (const file of shots) {
  const name = basename(file, '.png')
  const current = join(SHOTS, file)
  const base = join(BASELINE, file)
  const limit = budget.perShot?.[name] ?? budget.default

  if (!existsSync(base)) {
    rows.push({ name, pct: null, limit, verdict: 'NUOVO' })
    missing++
    continue
  }

  const result = await compare(base, current, join(DIFFS, file), {
    // antialiasing: i bordi delle lettere e della mesh cambiano di un filo fra due run senza che
    // sia cambiato nulla. Non è la regressione che stiamo cercando.
    antialiasing: true,
    threshold: 0.1,
    diffColor: '#ff00ff',
    outputDiffMask: false,
    noFailOnFsErrors: true,
  })

  if (result.match) {
    rmSync(join(DIFFS, file), { force: true })
    rows.push({ name, pct: 0, limit, verdict: 'PASS' })
    continue
  }

  if (result.reason !== 'pixel-diff') {
    rows.push({ name, pct: null, limit, verdict: `FAIL (${result.reason})` })
    failed++
    continue
  }

  const pct = result.diffPercentage
  const ok = pct <= limit
  if (ok) rmSync(join(DIFFS, file), { force: true })
  rows.push({ name, pct, limit, verdict: ok ? 'PASS' : 'FAIL' })
  if (!ok) failed++
}

const w = Math.max(...rows.map((r) => r.name.length))
for (const r of rows) {
  const pct = r.pct === null ? '   —  ' : `${r.pct.toFixed(2)}%`.padStart(7)
  console.log(`  ${r.name.padEnd(w)}  ${pct}  ≤${String(r.limit).padStart(5)}%  ${r.verdict}`)
}

writeFileSync(join(DIFFS, 'report.json'), JSON.stringify({ rows, failed, missing }, null, 2))

console.log(
  `\n${rows.length} scatti · ${failed} oltre budget · ${missing} senza baseline` +
    (missing ? ' (lancia `npm run qa:bless` per fissarla)' : ''),
)
if (failed > 0) {
  console.log(`\nSolo questi vanno guardati con gli occhi — il diff evidenziato è in ${DIFFS}/:`)
  for (const r of rows.filter((x) => x.verdict.startsWith('FAIL'))) {
    console.log(`  ${join(DIFFS, `${r.name}.png`)}`)
  }
  process.exitCode = 1
}
