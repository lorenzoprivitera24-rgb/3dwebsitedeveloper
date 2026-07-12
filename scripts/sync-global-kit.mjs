#!/usr/bin/env node
// sync-global-kit.mjs — THIS REPO is the canonical source of the shared 3D kit.
// Copies the 6 specialist agents + the web3d-integration-patterns skill (SKILL.md +
// references/) to ~/.claude, so 3D work OUTSIDE this repo (Laribinto, client sites)
// uses fresh definitions instead of stale global copies (audit 12 lug 2026).
// Global-only extras in the skill dir (react-bits/ mirror, STACK.md) are preserved.
// Usage: npm run sync:global  (run after every change to .claude/agents or the skill)
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const home = os.homedir()

const AGENTS = [
  'r3f-scene-architect',
  'tsl-shader-engineer',
  'scroll-motion-engineer',
  'ui-overlay-a11y-engineer',
  'interaction-engineer',
  'perf-fallback-auditor',
]

let copied = 0
const globalAgents = join(home, '.claude', 'agents')
mkdirSync(globalAgents, { recursive: true })
for (const a of AGENTS) {
  const src = join(repo, '.claude', 'agents', `${a}.md`)
  if (!existsSync(src)) {
    console.error(`manca ${src} — repo incompleto?`)
    process.exit(1)
  }
  cpSync(src, join(globalAgents, `${a}.md`))
  copied++
}

const srcSkill = join(repo, '.claude', 'skills', 'web3d-integration-patterns')
const dstSkill = join(home, '.claude', 'skills', 'web3d-integration-patterns')
mkdirSync(join(dstSkill, 'references'), { recursive: true })
cpSync(join(srcSkill, 'SKILL.md'), join(dstSkill, 'SKILL.md'))
copied++
for (const f of readdirSync(join(srcSkill, 'references'))) {
  cpSync(join(srcSkill, 'references', f), join(dstSkill, 'references', f))
  copied++
}

console.log(
  `sync:global — ${copied} file copiati repo → ~/.claude ` +
  `(${AGENTS.length} agenti + skill). Extra globali (react-bits/, STACK.md) preservati.`,
)
