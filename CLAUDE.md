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

### Non-negotiable rules

1. **`framer-motion-3d` is banned.** It is discontinued and breaks on React 19. Never import it,
   never use `motion.mesh`. Animate 3D via `useFrame` / React Spring / GSAP. Motion is DOM-only.
2. **One animation owner per property.** A given uniform, camera, or object property is driven by
   exactly one system. Mixing causes jitter.
3. **One scroll/RAF loop.** Lenis + `gsap.ticker` is the single source. No stray
   `requestAnimationFrame` on scroll-linked things.
4. **Scroll progress lives in a ref**, not React state. No per-frame re-renders.
5. **Ease everything.** Scroll and pointer values pass through `MathUtils.damp`
   (framerate-independent) before reaching uniforms or the camera.
6. **Mobile is first-class.** Cap `dpr` at 2, instance repeats, reduce amplitude and subdivisions
   on small viewports, use the quality tiers in the skill.
7. **Accessibility is part of "done".** `prefers-reduced-motion` path, canvas `aria-hidden`,
   interactive controls mirrored in accessible DOM, contrast over the moving background, intact
   keyboard order.
8. **No browser storage** in the canvas layer; transient state in refs/React state.

## Orchestration: how the main session delegates

Sub-agents cannot spawn sub-agents, so this main session is the orchestrator. Default build order
(adapt to the brief):

1. `@agent-r3f-scene-architect`: project skeleton, async WebGPU `Canvas`, scene graph, camera,
   lights, asset pipeline, the single Lenis + GSAP loop, and `ARCHITECTURE.md` defining the
   component contract (the scroll-progress ref and the shader uniforms).
2. `@agent-tsl-shader-engineer`: the TSL node materials (scroll + pointer displacement, RGB shift,
   any compute particles), exposing well-named uniforms per the contract.
3. `@agent-scroll-motion-engineer`: bind scroll progress and pointer/touch to the uniforms and the
   camera, build the ScrollTrigger timeline, tune the damping for desktop and mobile.
4. `@agent-ui-overlay-a11y-engineer`: the DOM overlay with Motion, responsive and touch-friendly,
   with the reduced-motion path and ARIA.
5. `@agent-interaction-engineer`: the interactivity layer — pick + copy + wire React Bits components
   (`lib/react-bits/`) and bespoke GSAP/Motion/Lenis/`@use-gesture` effects (animated headlines,
   scroll reveals, cursor/hover effects, animated menus, galleries, animated backgrounds), without
   breaking the single loop or a11y.
6. `@agent-perf-fallback-auditor`: read-only audit (draw calls, instancing, DPR, fallback,
   reduced-motion, accessibility); returns a prioritized report that the others apply.

Chain them: e.g. "Use the tsl-shader-engineer to build the displacement material, then the
scroll-motion-engineer to drive its uniforms from scroll and pointer." Run independent research
in parallel where it helps, but keep edits serialized to avoid conflicts.

**Auto-dispatch (every prompt).** A `UserPromptSubmit` hook (`.claude/hooks/agents-autostart.py`)
reads each request and injects the matching specialist so delegation happens on its own — engaging
the specialist is the default, not something to ask permission for. It also reminds: independent
research can run in parallel, but **serialize edits** (one owner per property, one RAF loop); use
`isolation: worktree` for parallel branches. Same non-negotiables apply (no `framer-motion-3d`, one
loop, ease everything, mobile + a11y in "done").

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
`npm run assets:encode` (GLB/KTX2) · `npm run cutouts:encode` (**cut-out layers → AVIF/WebP +
baked contact shadows + typed manifest**; `cutouts:fixture` draws a stand-in product to
choreograph against before the client's photography arrives) · `npm run qa:verify` (single-shot:
real backend + console + screenshot) · `npm run qa:shoot` (per-section × 390/834/1440) ·
`npm run qa:scrub -- <section> <frames> <w> <h>` (**frames spread through a PINNED section's
run** — `qa:shoot` always captures state A, so on a scrubbed pin it certifies motion nobody
watched move) · `npm run perf:check` (budget gate).
Verification runs on playwright-core + the cached Chrome for Testing — NOT the user's Chrome
(it cannot reach local servers on this machine) and NOT the preview MCP from a worktree.

### The layered-product family (07 · 13 · 14) — the genre that is NOT 3D

A whole class of client references — food, beverage, packaging, hardware — looks like 3D and is
not. It is **cut-out photography with real alpha**, stacked and choreographed on scroll (usually
built in Framer). Reading it as a 3D brief costs weeks. The kit now covers it: blueprints
**13 `product-explode`**, **14 `type-behind-product`**, **07 `editorial-gallery`**, all fed by one
asset contract (`scripts/encode-cutouts.mjs`, shared-canvas registration) and one grammar, the
`layered-product-choreography` skill. Recon: `docs/recon-prodotto-a-strati-ago2026.md`.

**Say it in S0, not in S5:** without alpha there is nothing to occlude and nothing to separate.
If the client sends JPEGs on a solid background, the job is cut-out work, not animation.

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

- Runs at the frame budget on a throttled mid-tier mobile profile.
- WebGPU path works; WebGL2 fallback works; a no-WebGL poster exists.
- `prefers-reduced-motion` respected; accessibility checklist passed.
- One loop, one owner per property, no `framer-motion-3d`, no browser storage in the canvas.
