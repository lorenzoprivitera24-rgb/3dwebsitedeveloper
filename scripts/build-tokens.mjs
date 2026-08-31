#!/usr/bin/env node
// build-tokens.mjs — il ponte dei token: brief/direction.md → CSS vars + costanti TS.
// DOM e canvas leggono la STESSA fonte; nessun colore/durata esiste fuori da direction.md.
//
// Legge il primo blocco ```json con chiave "tokens" da brief/direction.md e genera:
//   src/styles/tokens.css        (:root — sovrascrive i fallback di styles.css: importato dopo)
//   src/lib/tokens.generated.ts  (const TOKENS per le uniform TSL e i componenti)
// Uso: npm run tokens:build   [DIRECTION=path/alternativo.md]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const SRC = resolve(process.env.DIRECTION ?? 'brief/direction.md')
const OUT_CSS = resolve('src/styles/tokens.css')
const OUT_TS = resolve('src/lib/tokens.generated.ts')

const md = readFileSync(SRC, 'utf8')
const blocks = [...md.matchAll(/```json\s*([\s\S]*?)```/g)].map((m) => m[1])
let tokens = null
for (const b of blocks) {
  try {
    const parsed = JSON.parse(b)
    if (parsed && parsed.tokens) { tokens = parsed.tokens; break }
  } catch { /* blocco json non-tokens: ignora */ }
}
if (!tokens) {
  console.error(`✗ Nessun blocco \`\`\`json con chiave "tokens" in ${SRC}`)
  process.exit(1)
}

const HEX = /^#[0-9a-fA-F]{6}$/
const fail = (msg) => { console.error('✗ tokens non validi: ' + msg); process.exit(1) }
const need = (obj, keys, where) => {
  for (const k of keys) if (obj?.[k] === undefined) fail(`manca ${where}.${k}`)
}
need(tokens, ['colors', 'gradient', 'fonts', 'motion'], 'tokens')
need(tokens.colors, ['bg', 'bg2', 'fg', 'muted', 'accent'], 'colors')
need(tokens.gradient, ['a', 'b', 'c', 'flow'], 'gradient')
need(tokens.fonts, ['display', 'body'], 'fonts')
need(tokens.motion, ['micro', 'base', 'sceneVh'], 'motion')
for (const [k, v] of Object.entries({ ...tokens.colors, a: tokens.gradient.a, b: tokens.gradient.b, c: tokens.gradient.c })) {
  if (!HEX.test(v)) fail(`"${k}" non è un hex #rrggbb: ${v}`)
}

const header = `/* GENERATED da scripts/build-tokens.mjs ← brief/direction.md — NON EDITARE A MANO */`
const q = (f) => `'${f}'`
const css = `${header}
:root {
  --bg: ${tokens.colors.bg};
  --bg-2: ${tokens.colors.bg2};
  --fg: ${tokens.colors.fg};
  --muted: ${tokens.colors.muted};
  --accent: ${tokens.colors.accent};
  --display: ${q(tokens.fonts.display)}, Georgia, 'Times New Roman', serif;
  --body: ${q(tokens.fonts.body)}, ui-sans-serif, system-ui, sans-serif;
  --mono: ${q(tokens.fonts.mono ?? 'ui-monospace')}, ui-monospace, 'SF Mono', monospace;
  /* facoltativo: il grottesco stretto e pesante del genere «prodotto editoriale» (blueprint 14).
     Assente ⇒ ricade sul display, così i progetti che non lo usano non devono dichiararlo. */
  --display-condensed: ${tokens.fonts.condensed ? `${q(tokens.fonts.condensed)}, ` : ''}var(--display);
  --size-display: clamp(2.8rem, 1rem + 9vw, 9rem);
  --size-eyebrow: 0.78rem;
  --motion-micro: ${tokens.motion.micro}s;
  --motion-base: ${tokens.motion.base}s;
}
`

const ts = `// GENERATED da scripts/build-tokens.mjs ← brief/direction.md — NON EDITARE A MANO
// Fonte unica per le uniform TSL e i componenti: stessa verità del CSS (tokens.css).
export const TOKENS = ${JSON.stringify(tokens, null, 2)} as const

export type Tokens = typeof TOKENS
`

mkdirSync(dirname(OUT_CSS), { recursive: true })
writeFileSync(OUT_CSS, css)
writeFileSync(OUT_TS, ts)
console.log(`✓ tokens → ${OUT_CSS}\n✓ tokens → ${OUT_TS}`)
