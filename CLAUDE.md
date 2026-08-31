# CLAUDE.md: project constitution for a modern 3D website (August 2026)

This file orchestrates the build and is paid on **every** session and every subagent, so it holds
rules only. The history of why the kit is shaped this way lives in [`docs/README.md`](docs/README.md);
the deep technical playbook is the `web3d-integration-patterns` skill under `.claude/skills/`.

## What we are building

A modern 3D website where **the geometry and the interface morph as the user scrolls (desktop) and
as they touch the screen (mobile)**. The signature feature is vertex displacement driven by two
eased signals: scroll progress and pointer position. A DOM interface animates in sync above the
canvas without fighting it.

## The stack (pinned 6 Aug 2026)

- **Build**: **Vite 8** (Rolldown/Rust). `build.rolldownOptions`, not `rollupOptions`.
- **Renderer**: Three.js **0.185** via `three/webgpu`. WebGPU first, automatic WebGL2 fallback. The
  `Canvas` `gl` prop is an **async factory** that calls `await renderer.init()`.
- **React layer**: React Three Fiber v9 on **React 19**. **TypeScript 6** (see `docs/README.md` for
  why not 7). **Shaders**: **TSL** (`three/tsl`); raw GLSL is a documented exception.
- **Scroll**: **Lenis** driven by `gsap.ticker` — one RAF source for the whole app.
  **Timeline**: **GSAP 3.15** with `@gsap/react` `useGSAP` + ScrollTrigger/ScrollSmoother.
- **3D motion**: `useFrame` (with `MathUtils.damp`), `@react-spring/three`, or GSAP.
  **DOM UI motion**: **Motion 13** (`motion/react`), DOM only. **Gestures**: `@use-gesture/react`.
- **Tuning**: **Leva**, dev-only, bound to the presets in `looks/`.
- **Shelves** (copy-first, offline, GDPR — full catalogs and licences in `STACK.md` §2/§2b):
  `lib/react-bits/` (134 interactive components — **the only source of truth**, mirrored to the
  global skill by `npm run sync:global`), `lib/componentry/` (51), `lib/patterns/` (87 SVG),
  `lib/fonts/` (30 self-hosted — **never** the CDN), `lib/illustrations/` (~2.960 SVG; see its
  `ATTRIBUTION.md` — unDraw forbids repacking and AI use).

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
| 9 | **nothing importing three in the entry's static graph** — the 3D layer enters via `lazy(() => import('./canvas/CanvasLayer'))`; DOM reads canvas state from `src/lib/loadProgress.ts` (599 → 156,5 KB gzip) | `perf:check` (reads the Vite manifest) |
| 10 | **no hand-tuned number in the source** — screen-set values live in `looks/<section>.json` with a Leva knob | judgement (review) + `looks/README.md` |

Also mechanical: no `<Environment preset>` (third-party CDN → GDPR); self-host the HDRI.

## Orchestration: one builder, many verifiers

The agents split into two families, and the split is the whole point.

**Builders — never fanned out over the same property space.** `r3f-scene-architect`,
`tsl-shader-engineer` and `scroll-motion-engineer` read and write the SAME uniform contract:
run them as ONE sequential track (or one session wearing three skills). Parallel builders make
conflicting implicit decisions that nobody can reconcile afterwards.
`ui-overlay-a11y-engineer` and `interaction-engineer` own the DOM layer — a different property
space — so they may run alongside the scene track, serialized against each other on shared files.

**Verifiers — parallel, read-only, fresh context. This is where fan-out pays**, because a model
catches an error far more reliably when it arrives as external content than in its own trace.
`perf-fallback-auditor` (read-only) and `visual-qa-operator` (writes `qa/issues.md`, never
`src/`) report; the builder applies.

Upstream producers (`creative-director`, `scroll-storyboarder`, `copy-chief`, `asset-wrangler`,
`blueprint-librarian`) touch `brief/`, `content/`, `public/` — not `src/` — so they parallelize
freely. Sub-agents cannot spawn sub-agents: this session orchestrates. Use `isolation: worktree`
when a builder needs its own branch.

**Open item (Aug 2026).** `.claude/hooks/agents-autostart.py` still injects a specialist on every
prompt, half of it now redundant with ESLint and `qa:state`. Narrow it to two-signal matches or
retire it — Lorenzo applies it by hand (edits under `.claude/hooks/` are refused as
self-modification).

## The factory: from client request to shipped site

**`PIPELINE_STATUS.md` is the first thing every session reads**; advancing it is part of each
stage's "done". Human gates (G) need an explicit OK.

```
S0 intake (skill client-intake)      → brief/brief.md                    (G)
S1 creative-director                 → brief/direction.md + tokens block (G)
S2 scroll-storyboarder               → brief/storyboard.md               (G)
S3 copy-chief                        → content/*.json
S4 asset-wrangler                    → public/assets/* + assets-manifest.json
S5 blueprint-librarian + specialists → sections from /registry (+ CUSTOM), tuning → looks/*.json
S6 visual-qa-operator                → qa:shoot + qa:diff → qa/issues.md → fix loop (max 3 rounds)
S7 perf-fallback-auditor             → qa/perf-report.md (G) → deploy
```

**The golden rule: before writing any section from scratch, consult `/registry`** (INDEX.md).
Compose and parameterise blueprints; write custom only for what the registry lacks, then promote it.
No stage starts without the previous stage's artifact.

Factory commands: `npm run tokens:build` (direction.md → tokens.css + tokens.generated.ts) ·
`npm run assets:encode` (GLB/KTX2) · `npm run cutouts:encode` (**cut-out layers → AVIF/WebP +
baked contact shadows + typed manifest**; `cutouts:fixture` draws a stand-in product to
choreograph against before the client's photography arrives) · `npm run qa:verify` (single-shot:
real backend + console + screenshot) · **`qa:diff`** (numeric gate against `qa/baseline/`; images
only for what fails) · `qa:bless` (promote to baseline, pruning stale shots) ·
`npm run qa:scrub -- <section> <frames> <w> <h>` (**frames spread through a PINNED section's
run** — `qa:shoot` always captures state A, so on a scrubbed pin it certifies motion nobody
watched move) · `qa:reduced` (the shoot pass under `prefers-reduced-motion`) · `sync:global`.
Verification runs on playwright-core + the cached Chrome for Testing — NOT the user's Chrome
(it cannot reach local servers on this machine) and NOT the preview MCP from a worktree.

### The three gates — three natures of determinism, so three gates

| gate | command | determinism | contract |
|---|---|---|---|
| **state** | `qa:state` | **total** — no GPU, no pixels, no clock | `qa/checkpoints.json` + `qa/state-baseline.json` |
| **pixel** | `qa:shoot` (+ `qa:scrub`, `qa:reduced`) | perceptual — real GPU, empty-canvas guard | shots per section × breakpoint, vs `qa/baseline/` |
| **frame** | `qa:frames` | statistical — long-frame tail, per render path | `qa/budget.json` |

`npm run verify` = lint + build + `perf:check` + `qa:state`: deterministic, headless, always
runnable. `verify:full` adds the gates that need a real GPU. Direction changed on purpose? Re-run
`qa:state:baseline` and commit the diff — that diff *is* the review.

Why the budget is per-path, and why `renderer.info` cannot be read naively: the reasons are in
`qa/budget.json` and in the header of `src/qa/QaSceneBridge.tsx`, next to the code they govern.

A green build is **not** proof (WebGPU/TSL gotchas pass `tsc`/`vite` and break on screen) — and a
green *gate* is not proof either if it measures the wrong thing: `qa:verify` reports which backend
actually ran and how the preloader became ready, precisely because both can degrade in silence.

### The layered-product family (13 · 14 · 15) — the genre that is NOT 3D

A whole class of client references — food, beverage, packaging, hardware — looks like 3D and is
not. It is **cut-out photography with real alpha**, stacked and choreographed on scroll (usually
built in Framer). Reading it as a 3D brief costs weeks. The kit now covers it: blueprints
**13 `product-explode`**, **14 `type-behind-product`**, **15 `product-gallery`** (renumbered from
its birth as 07 — the 07 slot is the cutout-free editorial gallery), all fed by one asset contract
(`scripts/encode-cutouts.mjs`, shared-canvas registration) and one grammar, the
`layered-product-choreography` skill. Recon: `docs/recon-prodotto-a-strati-ago2026.md`.

**Say it in S0, not in S5:** without alpha there is nothing to occlude and nothing to separate.
If the client sends JPEGs on a solid background, the job is cut-out work, not animation.

### The recon corpus (lug 2026) — where this architecture comes from

## Tips

- `ARCHITECTURE.md` is the shared source of truth for the component contract. Keep it current.
- Agents may accumulate knowledge under `.claude/agent-memory/`. Ask them to consult and update it.
- **This repo is canonical for the shared kit**: the global copies of the 6 agents, the skill and
  the React Bits shelf in `~/.claude/` are regenerated by `npm run sync:global` — never edit them by
  hand. They rotted once already (see `docs/README.md`).

## Definition of done

`npm run verify` green — and, before a release, `npm run verify:full`. That command *is* the
definition; what follows is what it does and does not cover.

Covered mechanically: the eight non-negotiables (see the table above), the scroll→scene contract, the lazy entry boundary (perf:check reads the manifest: nothing importing three may sit in the entry's static graph — measured 599 → 156,5 KB gzip).
at every checkpoint, the frame budget per render path, the empty-canvas failure.

Still judgement, and still required:
- WebGL2 fallback exercised and a no-WebGL poster present (the gates measure whichever path the
  browser picked — they do not force the other one).
- Accessibility beyond `dpr` and reduced-motion: keyboard order, contrast over a moving
  background, controls mirrored in accessible DOM.
- A real device once before shipping: CDP throttles the CPU, **never the GPU**, so a "mid-tier
  mobile profile" here is a CPU approximation, not a measurement.
- No hand-tuned number in the source: screen-set values belong in `looks/<section>.json` with a Leva knob (`looks/README.md`).
