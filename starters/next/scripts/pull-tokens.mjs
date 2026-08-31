#!/usr/bin/env node
// Ponte token kit → starter: copia il BLOCCO :root generato da build-tokens.mjs dentro
// app/globals.css (fra i marcatori impliciti: dall'inizio del file al primo selettore non-:root).
// Un solo ponte, una sola fonte: si edita brief/direction.md nel kit, mai i valori qui.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const source = resolve(here, '../../../src/styles/tokens.css')
const target = resolve(here, '../app/globals.css')

const tokens = readFileSync(source, 'utf8')
const rootBlock = tokens.match(/:root \{[\s\S]*?\n\}/)?.[0]
if (!rootBlock) {
  console.error(`✗ nessun blocco :root in ${source}`)
  process.exit(1)
}

const css = readFileSync(target, 'utf8')
const updated = css.replace(/:root \{[\s\S]*?\n\}/, rootBlock)
writeFileSync(target, updated)
console.log(`✓ token aggiornati da ${source}`)
