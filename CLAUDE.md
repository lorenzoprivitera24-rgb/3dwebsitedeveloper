# CLAUDE.md: project constitution for a modern 3D website (June 2026)

This file orchestrates the build. The main Claude Code session reads it on startup and uses it
to delegate to the specialized sub-agents in `.claude/agents/`. The deep technical playbook lives
in the `web3d-integration-patterns` skill under `.claude/skills/`.

## What we are building

A modern 3D website where **the geometry and the interface morph as the user scrolls (desktop)
and as they touch the screen (mobile)**. The signature feature is vertex displacement / distortion
driven by two eased signals: scroll progress and pointer position. A DOM interface animates in sync
above the canvas without fighting it.

## The stack (June 2026), and the rules that come with it

- **Renderer**: Three.js r171+ via `three/webgpu`. WebGPU first, automatic WebGL2 fallback. The
  `Canvas` `gl` prop is an **async factory** that calls `await renderer.init()`.
- **React layer**: React Three Fiber v9 on **React 19**.
- **Shaders**: **TSL** (`three/tsl`), node-based, renderer-agnostic (compiles to WGSL and GLSL).
  Raw GLSL strings are a documented exception, not the default.
- **Scroll**: **Lenis**, driven by `gsap.ticker`. One RAF source for the whole app.
- **Scroll/timeline animation**: **GSAP 3.13+** (now fully free, all plugins) with
  `@gsap/react` `useGSAP` and ScrollTrigger / ScrollSmoother.
- **3D object motion**: `useFrame` (with `MathUtils.damp`), `@react-spring/three`, or GSAP.
- **DOM UI motion**: **Motion** (`motion/react`). DOM only.
- **Gestures**: `@use-gesture/react` (drag/pinch/hover/wheel). **Lightweight GLSL backgrounds**: `ogl`.
- **Interactivity layer**: **React Bits** — 134 copy-paste interactive components vendored in
  `lib/react-bits/` (catalog `lib/react-bits/CATALOG.md`). Pick + copy + tune; don't hand-roll what
  it ships. See the `interaction-engineer` agent.
- **Design-asset shelves** (same copy-first, offline, GDPR model — see `STACK.md` §2/§2b):
  `lib/componentry/` (51 MIT components: WebGL backgrounds, magnetic UI, kinetic text — DOM layer),
  `lib/patterns/` (87 Hero Patterns SVG **CC BY 4.0** + pattern.css MIT — section backdrops),
  `lib/fonts/` (30 self-hosted Google Fonts + `scripts/add-font.mjs` — **never** the CDN, GDPR),
  `lib/illustrations/` (~2,960 SVG — unDraw 1362 editorial + DiceBear 1488 + Open Doodles 33 CC0 +
  Humaaans — for hero/empty-state art; CC-BY sets + Humaaans need attribution, unDraw has its own
  no-repack/no-AI license → `lib/illustrations/ATTRIBUTION.md`). **Mobbin** is reference-only (paid, copyrighted
  screenshots — nothing to vendor): `docs/inspiration/mobbin.md`. Each shelf has its own catalog.
- **Realism**: PBR + real KTX2 textures, triplanar anti-tiling, IBL/HDRI, post FX, organic TSL
  geometry. **`STACK.md`** is the one-page stack; the skill's `references/realism-and-interactivity.md`
  and `references/interactive-components.md` are the playbooks. A green build is **not** proof —
  verify in a real browser preview (the WebGPU/TSL gotchas there pass `tsc`/`vite` and break on screen).

### Non-negotiable rules — and who enforces each one

A rule a machine can check does not need to live in your context. Most of these are now enforced;
what remains in prose is what still needs judgement.

| # | rule | enforced by |
|---|---|---|
| 1 | `framer-motion-3d` is banned (discontinued, breaks React 19) | ESLint `no-restricted-imports` |
| 2 | **one animation owner per property** — a uniform/camera/property is driven by exactly one system | `qa:state` (an uniform that converges to its target has one writer) |
| 3 | **one scroll/RAF loop** — Lenis + `gsap.ticker`, no stray `requestAnimationFrame` | ESLint `no-restricted-syntax` |
| 4 | scroll progress lives in a **ref**, not React state | judgement (review) |
| 5 | **ease everything** — scroll/pointer pass through `MathUtils.damp` before uniforms/camera | `qa:state` (convergence assertions) |
| 6 | mobile first-class — `dpr` ≤ 2, tiered detail/amplitude | `qa:state` (dpr) + `qa:frames` (per-path budget) |
| 7 | accessibility is part of "done" — reduced-motion path, `aria-hidden` canvas, contrast, keyboard order | judgement + `perf-fallback-auditor` |
| 8 | no browser storage in the canvas layer | ESLint `no-restricted-globals/properties` |

Also mechanical: no `<Environment preset>` (third-party CDN → GDPR); self-host the HDRI.

## Orchestration: one builder, many verifiers

The agents split into two families, and the split is the whole point.

**Builders — never in parallel with each other on the same property space.** Anthropic's own
finding on multi-agent systems is that domains requiring shared context and many inter-agent
dependencies are a bad fit, and that coding has fewer truly parallelizable subtasks than research;
Cognition's is sharper — *actions carry implicit decisions, and conflicting implicit decisions
produce bad results*. The scene track is exactly that: `r3f-scene-architect`,
`tsl-shader-engineer` and `scroll-motion-engineer` all read and write the SAME uniform contract.
Run them as **one sequential track**, or as one session wearing three skills. Never as a fan-out.
`ui-overlay-a11y-engineer` and `interaction-engineer` work a different property space (the DOM
layer), so they may run alongside the scene track — still serialized against each other on shared
files.

**Verifiers — parallel, read-only, fresh context. This is where fan-out pays.** The research on
self-correction is unambiguous: intrinsic self-correction does not improve (and can degrade)
results, while the same model catches the same error reliably when it arrives as *external*
content. A verifier therefore needs a context that never saw the code being written:
`perf-fallback-auditor` (read-only by construction) and `visual-qa-operator` (may write
`qa/issues.md`, never `src/`). Their findings go back to the builder — they don't apply them.

Upstream artefact producers (`creative-director`, `scroll-storyboarder`, `copy-chief`,
`asset-wrangler`, `blueprint-librarian`) touch `brief/`, `content/`, `public/` — not `src/` —
so they parallelize freely.

Sub-agents cannot spawn sub-agents: this main session is the orchestrator. Use
`isolation: worktree` when a builder needs a branch of its own.

**Open item (Aug 2026).** The `UserPromptSubmit` hook `.claude/hooks/agents-autostart.py` still
injects a specialist on *every* prompt. Half of what it repeats is now enforced by ESLint and by
`qa:state`, and always-on injection is the pattern Anthropic identified as over-constraining when
they cut 80%+ of Claude Code's system prompt for the Claude 5 models — the failure mode being
conflicting instructions arriving from prompt, CLAUDE.md and skills at once. It should be narrowed
to genuine two-signal matches or retired. Edits under `.claude/hooks/` are refused by the
permission classifier as self-modification, so this is a change Lorenzo applies by hand.

## The factory: from client request to shipped site

Client work runs through an 8-stage pipeline. **`PIPELINE_STATUS.md` is the first thing every
session reads**; advancing it is part of each stage's "done". Human gates (G) need an explicit OK.

```
S0 intake (skill client-intake)   → brief/brief.md                    (G)
S1 creative-director              → brief/direction.md + tokens block (G)
S2 scroll-storyboarder            → brief/storyboard.md               (G)
S3 copy-chief                     → content/*.json
S4 asset-wrangler                 → public/assets/* + assets-manifest.json
S5 blueprint-librarian + specialists → sections from /registry (+ CUSTOM)
S6 visual-qa-operator             → qa/issues.md → fix loop (max 3 rounds)
S7 perf-fallback-auditor          → qa/perf-report.md (G) → deploy
```

**The golden rule: before writing any section from scratch, consult `/registry`** (INDEX.md).
Compose and parameterize blueprints; write custom only for what the registry doesn't cover, then
promote it. No stage starts without the previous stage's artifact.

Factory commands: `npm run tokens:build` (direction.md → tokens.css + tokens.generated.ts) ·
`npm run assets:encode` · `npm run qa:verify` (single-shot: real backend + console + screenshot).
Verification runs on playwright-core + the cached Chrome for Testing — NOT the user's Chrome
(it cannot reach local servers on this machine) and NOT the preview MCP from a worktree.

### The three gates — and why they are three

They have three different natures of determinism. Merging them yields a gate that fails at random
and that nobody reads any more.

| gate | command | determinism | contract |
|---|---|---|---|
| **state** | `qa:state` | **total** — no GPU, no pixels, no clock | `qa/checkpoints.json` (hand-written invariants) + `qa/state-baseline.json` (recorded direction) |
| **pixel** | `qa:shoot` | perceptual — needs a real GPU, has an empty-canvas guard | screenshots per section × breakpoint |
| **frame** | `qa:frames` | statistical — long-frame tail, per render path | `qa/budget.json` |

`npm run verify` = lint + build + `perf:check` + `qa:state`: deterministic, headless, always
runnable — **this is the definition of done**. `npm run verify:full` adds the two gates that need
a real GPU, and is the release gate.

Two measured facts worth keeping: `renderer.info.render.calls` **accumulates** across frames on
the WebGPU backend while `triangles` is reset, and reading either inside `useFrame` (which runs
*before* the render) yields zero — per-frame draw calls come from the delta between snapshots
taken outside the loop. And "under 100 draw calls" is a WebGL-era heuristic: on WebGPU draw calls
are cheap, so calls and triangles are **diagnostics** here, never thresholds — the threshold is
frame time. On the WebGL2 fallback the old heuristic still bites, which is why the budget is
per-path.

When the direction changes on purpose, re-run `npm run qa:state:baseline` and commit the diff:
the baseline diff *is* the review of the change.

### The recon corpus (lug 2026) — where this architecture comes from

The factory (registry, stages, visual-QA loop, perf gate) descends from a reverse-engineering
pass on the genre leaders — framer.com, threejs.paris, poch.studio, ylem.watch (8–9 lug 2026).
That corpus is tracked in-repo and is the project's strategic memory:
`docs/dossier-reverse-engineering-web3d.md` (how Framer/Webflow/Relume/v0 produce on demand) ·
`docs/playbook-web3d-kit-claude-code.md` (the changes it prescribed) ·
`docs/gap-analysis-2026-07-09.md` (20-variable have/gap map + the agreed sequence) ·
`docs/deep-dive-stack-e-librerie-asset.md` · `recon/` reports + `scripts/recon-fingerprint.mjs`
(re-runnable). Consult it before changing the stack; re-run the fingerprint when evaluating a
new library or a genre shift.

### Tips

- Let agents accumulate knowledge: `r3f-scene-architect` and (optionally) others use project
  memory under `.claude/agent-memory/`. Ask them to consult and update it.
- For heavy isolated work on a branch, an agent can run with `isolation: worktree`.
- `ARCHITECTURE.md` is the shared source of truth for the component contract. Keep it current.
- **This repo is canonical for the shared kit**: the global copies of the 6 specialist agents and
  of the `web3d-integration-patterns` skill in `~/.claude/` are regenerated with
  `npm run sync:global` — never edit the global copies by hand.

## Definition of done

`npm run verify` green — and, before a release, `npm run verify:full`. That command *is* the
definition; what follows is what it does and does not cover.

Covered mechanically: the eight non-negotiables (see the table above), the scroll→scene contract
at every checkpoint, the frame budget per render path, the empty-canvas failure.

Still judgement, and still required:
- WebGL2 fallback exercised and a no-WebGL poster present (the gates measure whichever path the
  browser picked — they do not force the other one).
- Accessibility beyond `dpr` and reduced-motion: keyboard order, contrast over a moving
  background, controls mirrored in accessible DOM.
- A real device once before shipping: CDP throttles the CPU, **never the GPU**, so a "mid-tier
  mobile profile" here is a CPU approximation, not a measurement.
