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

### Non-negotiable rules

1. **`framer-motion-3d` is banned.** Discontinued, breaks on React 19. Animate 3D via
   `useFrame` / React Spring / GSAP. Motion is DOM-only.
2. **One animation owner per property.** One uniform, camera or object property is driven by exactly
   one system. Mixing causes jitter.
3. **One scroll/RAF loop.** Lenis + `gsap.ticker`. No stray `requestAnimationFrame` on
   scroll-linked things.
4. **Scroll progress lives in a ref**, not React state. No per-frame re-renders.
5. **Ease everything** through `MathUtils.damp` before it reaches a uniform or the camera.
6. **Mobile is first-class.** Cap `dpr` at 2, instance repeats, cut amplitude and subdivisions on
   small viewports, use the skill's quality tiers.
7. **Accessibility is part of "done".** `prefers-reduced-motion` path, canvas `aria-hidden`,
   controls mirrored in accessible DOM, contrast over the moving background, intact keyboard order.
8. **No browser storage** in the canvas layer.
9. **Nothing that imports three may sit in the entry's static graph.** The 3D layer enters through
   `lazy(() => import('./canvas/CanvasLayer'))`; DOM components read canvas state from the
   dependency-free store in `src/lib/loadProgress.ts`. A single static `@react-three/drei` import
   from a DOM component silently un-splits the bundle — measured 599 → 156,5 KB gzip on first paint.
10. **No hand-tuned number stays in the source.** If a value is set by looking at the screen, it
    belongs in `looks/<section>.json` with a Leva knob. See `looks/README.md`.

## Orchestration

Sub-agents cannot spawn sub-agents, so the main session orchestrates. Default order, adapt to the
brief: `r3f-scene-architect` (skeleton, renderer, scene graph, the single loop, `ARCHITECTURE.md`)
→ `tsl-shader-engineer` (node materials, named uniforms) → `scroll-motion-engineer` (bind scroll and
pointer to uniforms and camera, tune damping) → `ui-overlay-a11y-engineer` (DOM overlay, reduced
motion, ARIA) → `interaction-engineer` (React Bits + bespoke effects) → `perf-fallback-auditor`
(read-only audit, returns a prioritised report the others apply). Each agent's own file states its
scope — don't restate it here.

A `UserPromptSubmit` hook (`.claude/hooks/agents-autostart.py`) injects the matching specialist, so
delegating is the default, not something to ask permission for. **Research in parallel, serialise
edits**; use `isolation: worktree` for parallel branches.

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

Commands: `npm run tokens:build` · `assets:encode` · `qa:verify` (single shot: real backend +
console + screenshot) · `qa:shoot` (per section × 390/834/1440) · **`qa:diff`** (numeric gate against
`qa/baseline/`; images only for what fails) · `qa:bless` (promote to baseline) · `perf:check` ·
`sync:global`. Verification runs on playwright-core + the cached Chrome for Testing — NOT the user's
Chrome (it cannot reach local servers here) and NOT the preview MCP from a worktree.

A green build is **not** proof: the WebGPU/TSL gotchas pass `tsc`/`vite` and break on screen. And a
green *gate* is not proof either if it measures the wrong thing — `qa:verify` reports which backend
actually ran and how the preloader became ready, precisely because both can degrade in silence.

## Tips

- `ARCHITECTURE.md` is the shared source of truth for the component contract. Keep it current.
- Agents may accumulate knowledge under `.claude/agent-memory/`. Ask them to consult and update it.
- **This repo is canonical for the shared kit**: the global copies of the 6 agents, the skill and
  the React Bits shelf in `~/.claude/` are regenerated by `npm run sync:global` — never edit them by
  hand. They rotted once already (see `docs/README.md`).

## Definition of done

- Runs at the frame budget on a throttled mid-tier mobile profile.
- WebGPU path works; WebGL2 fallback works; a no-WebGL poster exists.
- `prefers-reduced-motion` respected; accessibility checklist passed.
- One loop, one owner per property, no `framer-motion-3d`, no browser storage in the canvas,
  nothing importing three in the entry graph, no hand-tuned constants outside `looks/`.
