#!/usr/bin/env node
// sync-global-kit.mjs: THIS REPO is the canonical source of the shared 3D kit.
// GATE-NEGATIVO: rimesso il writer vecchio, cpSync(src, destinazione logica) sul catalogo, in una
// casa finta (HOME=...) coi 6 agenti a symlink verso il kit -> exit 1, sei volte «~/.claude/agents/
// <x>.md era un symlink (-> .../amplio-claude-kit/agents/<x>.md), ora e' un file normale» e nessun
// altro errore; lo script vero sulla stessa casa esce 0 (29 set 2026).
// GATE-NEGATIVO: saltata la scrittura in ~/amplio-claude-kit/agents (il sintomo del 29 set, agenti
// mai arrivati nel kit) col catalogo a copie staccate, come sul Mac di Lorenzo -> exit 1, sei volte
// «~/amplio-claude-kit/agents/<x>.md differisce dalla sorgente .claude/agents/<x>.md» e nessun
// errore sui link; lo script vero sulla stessa casa esce 0 (29 set 2026).
// Writes the 6 specialist agents + the web3d-integration-patterns skill (SKILL.md, references/,
// and the react-bits/ shelf mirrored from lib/) into the kit, ~/amplio-claude-kit: the git repo
// shared with the partner, which ~/.claude sees through the per-entry symlinks made by install.sh
// and skill-banco.py. So 3D work OUTSIDE this repo (Laribinto, client sites) uses fresh
// definitions instead of stale global copies (audit 12 lug 2026).
//
// Usage: npm run sync:global                 after every change to .claude/agents, the skill or lib/react-bits
//        npm run sync:global -- --ricollega  also turns detached catalog copies back into links to the kit
//        HOME=<dir> node scripts/sync-global-kit.mjs   the same run against a scratch home
//
// REAL PATH, NEVER THE LINK (29 set 2026). The previous version did cpSync(src,
// '~/.claude/agents/<x>.md'), and cpSync onto a destination that is a symlink deletes the link,
// writes a regular file and leaves the link target untouched (Node 24.17, no error). The skill
// reached the kit only because ~/.claude/skills/web3d-integration-patterns is a directory link,
// traversed as a path component; the agents never did: ~/.claude/agents held detached copies and
// ~/amplio-claude-kit/agents went stale at every agent edit (on 29 Sep scroll-motion-engineer.md
// had to be copied into the kit by hand). Now every destination is resolved with realpathSync
// before writing, and the run ends with a check: every destination byte-identical to its repo
// source, every path that was a symlink before the run still a symlink to the same target.
// Exit 1 otherwise.
//
// THE CATALOG IS NOT DECIDED HERE. Which agents sit in ~/.claude is the bench's call
// (~/.claude/brain/skill-banco.py): a missing entry is on the shelf and this script does not put
// it back. An entry that is a regular file is a copy detached from the kit: it is refreshed all
// the same, but the bench cannot remove it (it only touches links) and install.sh skips it.
// --ricollega replaces it with the link install.sh would have made, only when it is
// byte-identical to the kit file.
//
// The React Bits shelf lives in lib/react-bits/ and is the ONLY source of truth. The skill dir
// used to hold a hand-placed copy that silently rotted: on 9 Jul 2026 the repo patched
// ScrollReveal's cleanup (upstream killed EVERY ScrollTrigger on the page, including the kit's own
// Lenis driver) and the global copy kept shipping the broken upstream to every out-of-repo build.
// Mirroring it here means the divergence cannot come back. Kit-only extras (STACK.md) stay.
import {
  cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync,
  realpathSync, renameSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'

const repo = realpathSync(join(dirname(fileURLToPath(import.meta.url)), '..'))
const home = resolve(os.homedir()) // resolve drops a trailing slash, which would blind inside()
const KIT = join(home, 'amplio-claude-kit')
const CATALOG = join(home, '.claude')
const SKILL = 'web3d-integration-patterns'

const AGENTS = [
  'r3f-scene-architect',
  'tsl-shader-engineer',
  'scroll-motion-engineer',
  'ui-overlay-a11y-engineer',
  'interaction-engineer',
  'perf-fallback-auditor',
]

const unknown = process.argv.slice(2).filter((a) => a !== '--ricollega')
const RELINK = process.argv.includes('--ricollega')

const short = (p) => (p.startsWith(home + sep) ? `~${p.slice(home.length)}` : p)
const inside = (p, root) => p === root || p.startsWith(root + sep)

let phase = 'plan' // nothing is written while the plan can still fail
function stop(msg) {
  console.error(`sync:global: ✗ ${msg}`)
  if (phase === 'plan') console.error('sync:global: fermo prima di scrivere, niente e\' cambiato.')
  process.exit(1)
}
if (unknown.length) stop(`opzione sconosciuta: ${unknown.join(' ')} (esiste solo --ricollega)`)

// What sits at p without following a final link: 'link', 'dir', 'file', or null.
function kind(p) {
  let st
  try {
    st = lstatSync(p)
  } catch (e) {
    if (e.code === 'ENOENT') return null
    throw e
  }
  if (st.isSymbolicLink()) return 'link'
  return st.isDirectory() ? 'dir' : 'file'
}

// Where a write aimed at p really lands. realpathSync resolves the final link and every directory
// link along the way; when p does not exist yet, the nearest existing ancestor is resolved and
// the rest re-attached. A dangling link stops the run: writing behind it would create a file in
// a place nobody chose.
function real(p) {
  const rest = []
  let q = p
  while (!kind(q)) {
    rest.unshift(basename(q))
    q = dirname(q)
  }
  if (!existsSync(q)) stop(`${short(q)} e' un link rotto (-> ${readlinkSync(q)}): riparalo prima di sincronizzare`)
  return join(realpathSync(q), ...rest)
}

// A catalog entry (~/.claude/agents/<x>.md, ~/.claude/skills/<skill>) and how it reaches the kit.
function entry(p, kitReal) {
  const k = kind(p)
  if (!k) return { state: 'shelf' }
  if (k !== 'link') return { state: 'copy' }
  return { state: real(p) === kitReal ? 'link' : 'foreign-link', target: readlinkSync(p) }
}

// Files under root by relative path. root is followed if it is a link; links inside it are not
// followed, they are listed apart.
function tree(root) {
  const files = new Map()
  const links = []
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isSymbolicLink()) links.push(p)
      else if (e.isDirectory()) walk(p)
      else files.set(relative(root, p), p)
    }
  }
  if (existsSync(root)) walk(root)
  return { files, links }
}

// What separates tree b from tree a.
function gap(a, b) {
  const fa = tree(a).files
  const fb = tree(b).files
  return {
    missing: [...fa.keys()].filter((k) => !fb.has(k)),
    extra: [...fb.keys()].filter((k) => !fa.has(k)),
    changed: [...fa.keys()].filter((k) => fb.has(k) && !readFileSync(fa.get(k)).equals(readFileSync(fb.get(k)))),
  }
}
const even = (g) => !g.missing.length && !g.extra.length && !g.changed.length

// ---------- plan: every destination resolved before a single byte is written ----------
for (const d of [join(KIT, 'agents'), join(KIT, 'skills')])
  if (!existsSync(d)) stop(`manca ${short(d)}: agenti e skill arrivano nel kit, il repo condiviso col socio (clonalo, poi install.sh)`)

const units = [] // { src, dest: [logical paths] }
const mirrors = [] // { src, dest: [logical dirs] }, copied whole
const entries = [] // the catalog, for the summary and for --ricollega

for (const a of AGENTS) {
  const src = join(repo, '.claude', 'agents', `${a}.md`)
  if (!existsSync(src)) stop(`manca ${src}: repo incompleto?`)
  const kit = join(KIT, 'agents', `${a}.md`)
  const cat = join(CATALOG, 'agents', `${a}.md`)
  const e = { cat, kit, agent: true, ...entry(cat, real(kit)) }
  entries.push(e)
  units.push({ src, dest: e.state === 'shelf' ? [kit] : [kit, cat] })
}

const srcSkill = join(repo, '.claude', 'skills', SKILL)
const kitSkill = join(KIT, 'skills', SKILL)
const catSkill = join(CATALOG, 'skills', SKILL)
const skillEntry = { cat: catSkill, kit: kitSkill, agent: false, ...entry(catSkill, real(kitSkill)) }
entries.push(skillEntry)
const skillRoots = skillEntry.state === 'shelf' ? [kitSkill] : [kitSkill, catSkill]
const skillFiles = ['SKILL.md']
for (const e of readdirSync(join(srcSkill, 'references'), { withFileTypes: true })) {
  if (!e.isFile()) stop(`references/${e.name} non e' un file: lo script copia solo file`)
  skillFiles.push(join('references', e.name))
}
for (const f of skillFiles) units.push({ src: join(srcSkill, f), dest: skillRoots.map((r) => join(r, f)) })
const srcBits = join(repo, 'lib', 'react-bits')
mirrors.push({ src: srcBits, dest: skillRoots.map((r) => join(r, 'react-bits')) })

// Two logical paths that resolve to the same file are ONE write: with the catalog linked to the
// kit, ~/.claude/agents/<x>.md and the kit file are the same file.
const writes = new Map() // real path -> source
for (const u of units)
  for (const d of u.dest) {
    const r = real(d)
    if (inside(r, repo)) stop(`${short(d)} risolve dentro il repo (${r}): rifiuto di scriverci`)
    if (kind(r) === 'dir') stop(`${short(r)} e' una cartella, non un file`)
    if (writes.has(r) && writes.get(r) !== u.src) stop(`${short(r)} riceverebbe due sorgenti`)
    writes.set(r, u.src)
  }
const mirrorWrites = new Map() // real dir -> source dir
for (const m of mirrors)
  for (const d of m.dest) {
    const r = real(d)
    // mirroring = delete and copy again: a destination that resolves into the repo, or that
    // contains the source, would delete the source
    if (inside(r, repo) || inside(realpathSync(m.src), r)) stop(`${short(d)} risolve a ${r}: rispecchiarci cancellerebbe la sorgente`)
    const links = tree(r).links
    if (links.length) stop(`${short(r)} contiene ${links.length} link (es. ${short(links[0])}): il mirror li sostituirebbe con file normali`)
    mirrorWrites.set(r, m.src)
  }

// Link census BEFORE writing: every logical and real destination, plus their ancestors inside
// HOME. At the end each one must still be a link, to the same target.
const watched = new Set()
const watch = (p) => {
  watched.add(p)
  for (let q = dirname(p); inside(q, home) && q !== home; q = dirname(q)) watched.add(q)
}
for (const u of [...units, ...mirrors]) u.dest.forEach(watch)
for (const r of [...writes.keys(), ...mirrorWrites.keys()]) watch(r)
const linksBefore = new Map([...watched].filter((p) => kind(p) === 'link').map((p) => [p, readlinkSync(p)]))

// ---------- write: on real paths only ----------
phase = 'write'
const written = []
let alreadyEqual = 0
for (const [r, src] of writes) {
  const buf = readFileSync(src)
  if (existsSync(r) && readFileSync(r).equals(buf)) {
    alreadyEqual++
    continue
  }
  mkdirSync(dirname(r), { recursive: true })
  writeFileSync(r, buf)
  written.push(r)
}
const mirrored = []
for (const [r, src] of mirrorWrites) {
  const g = gap(src, r)
  if (even(g)) continue
  rmSync(r, { recursive: true, force: true })
  cpSync(src, r, { recursive: true })
  mirrored.push({ r, g })
}

// --ricollega: a detached copy becomes the link install.sh would have made (absolute target into
// the kit), only when it is byte-identical to the kit file, so nothing can be lost.
const relinked = []
if (RELINK)
  for (const e of entries.filter((x) => x.agent && x.state === 'copy')) {
    if (!readFileSync(e.cat).equals(readFileSync(e.kit))) continue // the check below reports it
    const tmp = `${e.cat}.sync-global-${process.pid}`
    symlinkSync(e.kit, tmp)
    renameSync(tmp, e.cat) // atomic: the entry is never missing, not even for an instant
    relinked.push(e)
  }

// ---------- check: every destination equal to its source, every link still a link ----------
phase = 'check'
const errors = []
// the logical path is what Claude Code reads, the real one is what ends up in the kit
const expected = new Map() // path -> source
for (const u of units) for (const d of u.dest) for (const p of [d, real(d)]) expected.set(p, u.src)
for (const [p, src] of expected) {
  if (!existsSync(p)) errors.push(`${short(p)} manca dopo il giro`)
  else if (!readFileSync(p).equals(readFileSync(src))) errors.push(`${short(p)} differisce dalla sorgente ${relative(repo, src)}`)
}
let mirrorChecks = 0
for (const m of mirrors)
  for (const d of new Set([...m.dest, ...m.dest.map(real)])) {
    mirrorChecks++
    const g = gap(m.src, d)
    if (!even(g))
      errors.push(`${short(d)} non rispecchia ${relative(repo, m.src)}: ${g.missing.length} mancanti, ` +
        `${g.extra.length} in piu', ${g.changed.length} diversi (primo: ${[...g.missing, ...g.extra, ...g.changed][0]})`)
  }
for (const [p, before] of linksBefore) {
  const k = kind(p)
  if (k !== 'link') errors.push(`${short(p)} era un symlink (-> ${before}), ora e' ${{ file: 'un file normale', dir: 'una cartella' }[k] ?? 'sparito'}`)
  else if (readlinkSync(p) !== before) errors.push(`${short(p)} puntava a ${before}, ora a ${readlinkSync(p)}`)
}
for (const e of relinked)
  if (kind(e.cat) !== 'link' || real(e.cat) !== real(e.kit)) errors.push(`${short(e.cat)} doveva tornare un link al kit`)

// ---------- summary ----------
const bits = [...tree(srcBits).files.keys()].filter((f) => f.endsWith('.tsx')).length
const kitOnly = gap(srcSkill, kitSkill).extra.filter((f) => !f.startsWith(`react-bits${sep}`))
console.log(`sync:global: repo -> kit ${short(KIT)} (catalogo ${short(CATALOG)})`)
console.log(`  ${units.length} sorgenti (${AGENTS.length} agenti, SKILL.md, ${skillFiles.length - 1} references) -> ` +
  `${writes.size} file reali: ${written.length} scritti, ${alreadyEqual} gia' uguali`)
for (const r of written) console.log(`    scritto ${short(r)}`)
console.log(`  react-bits da lib/ (${bits} componenti): ` +
  `${mirrored.length ? `${mirrored.length} destinazioni rispecchiate` : 'gia\' uguale'}`)
for (const { r, g } of mirrored)
  console.log(`    rispecchiato ${short(r)}: ${g.missing.length} nuovi, ${g.changed.length} cambiati, ${g.extra.length} tolti`)
if (kitOnly.length) console.log(`  extra del kit lasciati dove sono: ${kitOnly.join(', ')}`)
const count = (s) => entries.filter((e) => e.state === s).length
console.log(`  catalogo: ${count('link') + relinked.length} link al kit, ${count('copy') - relinked.length} copie staccate, ` +
  `${count('foreign-link')} link fuori dal kit, ${count('shelf')} sullo scaffale`)
for (const e of relinked) console.log(`    ricollegato ${short(e.cat)} -> ${short(e.kit)}`)
for (const e of entries) {
  if (e.state === 'copy' && !relinked.includes(e))
    console.log(`  ATTENZIONE ${short(e.cat)} e' una copia staccata dal kit, non un link: tenuta uguale al repo, ma ` +
      `skill-banco.py non la puo' togliere e install.sh la salta.` +
      (e.agent ? ' Ricollegala: npm run sync:global -- --ricollega' : ''))
  if (e.state === 'foreign-link')
    console.log(`  ATTENZIONE ${short(e.cat)} punta fuori dal kit (-> ${e.target}): aggiornati sia il bersaglio sia il kit`)
}

if (errors.length) {
  for (const e of errors) console.error(`  ✗ ${e}`)
  console.error(`sync:global: controllo FALLITO, ${errors.length} errori ` +
    `(${expected.size} file, ${mirrorChecks} mirror, ${linksBefore.size} link sorvegliati)`)
  process.exit(1)
}
console.log(`  controllo: ${expected.size} percorsi e ${mirrorChecks} mirror uguali byte per byte alla sorgente, ` +
  `${linksBefore.size} link ancora link verso lo stesso bersaglio`)
