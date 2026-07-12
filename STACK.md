# The Stack — modern, realistic, interactive websites (June 2026)

This is the **opinionated stack** the `3dwebsitedeveloper` kit builds with. It exists so that
every site produced here is *genuinely* realistic and interactive — not "build passes" but
"looks and feels real in a browser". It is the source of truth the agents in `.claude/agents/`
and the `web3d-integration-patterns` skill read before building.

> **The one rule that matters most:** a green `tsc -b && vite build` does **not** mean it works.
> WebGPU/TSL bugs pass the build and break on screen. **Always verify in a real browser preview**
> (screenshot + console) before claiming done. See `realism-and-interactivity.md`.

---

## 1. The layers (pin the ROLE, take the latest stable patch)

| Layer | Library (June 2026) | Role | When |
|---|---|---|---|
| Build | **Vite 6** + **React 19** + **TypeScript 5.6** | App shell, HMR, `tsc -b && vite build` | Always |
| Renderer | **three 0.184** via `three/webgpu` | WebGPU-first, auto WebGL2 fallback | Any 3D |
| Shaders | **`three/tsl`** (TSL node materials) | Vertex displacement, PBR node graphs, compute | Any custom material |
| Scene (React) | **@react-three/fiber 9.6** (React 19) | Declarative scene graph; `gl` async factory awaits `renderer.init()` | Any 3D in React |
| 3D helpers | **@react-three/drei 10.7** | `Environment` (IBL), loaders, `Html`, controls | Almost always |
| Post FX | **three/webgpu `PostProcessing`** (TSL `bloom`/`ao`) — NOT pmndrs/postprocessing on WebGPU | Bloom, GTAO, DOF | Realism |
| Physics | **@react-three/rapier 2.x** (+ `ecctrl` for character) | Rigid bodies, colliders as JSX | Real physics / playful interactions |
| Smooth scroll | **lenis 1.3** | The single RAF source for scroll | Any scroll-driven site |
| Timeline anim | **gsap 3.13** + **@gsap/react** (ScrollTrigger, SplitText, all plugins free) | Scrubbed sequences, pinning, reveals | Scroll narratives |
| DOM motion | **motion 12** (`motion/react`) | UI overlay animation only — NEVER `framer-motion-3d` | DOM layer |
| Pointer/gesture | **@use-gesture/react 10** | Drag, pinch, hover, wheel gestures | Interactive UI/3D |
| Lightweight GLSL | **ogl 1.x** | Cheap full-screen shader backgrounds without three | Background-only effects |
| Math/util | **maath**, **gl-matrix** | easing, random, vector math for shaders | As needed |
| **UI library** | **React Bits** (vendored in `lib/react-bits/`) | 134 copy-paste interactive components | The interactivity layer |
| **UI library (more)** | **Componentry** (vendored `lib/componentry/`) | 51 copy-paste MIT components (WebGL backgrounds, magnetic UI, kinetic text, scroll) | Interactivity layer (DOM) |
| **Backgrounds (static)** | **Hero Patterns + pattern.css** (`lib/patterns/`) | 87 themeable SVG patterns + 56 CSS classes | DOM/section backdrops, zero WebGPU cost |
| **Typography** | **Self-hosted Google Fonts** (`lib/fonts/`) | 30 curated woff2 families + `scripts/add-font.mjs` (any of ~1,900, offline) | GDPR-safe fonts |
| **Illustrations** | **unDraw + DiceBear + Open Doodles + Humaaans** (`lib/illustrations/`) | ~2,960 SVG: unDraw 1362 editorial + DiceBear 1488 (31 styles) + Open Doodles 33 (CC0) + Humaaans | Decorative / hero / empty-state art |

**Self-host fonts** (`@fontsource*`), **no third-party CDN at runtime** (GDPR): IBL HDRIs, KTX2
transcoder (`/basis/`), fonts — all local. drei's `Environment preset=` and `useKTX2` default
transcoder hit a CDN; override them (see realism reference). The self-hosted **font shelf** now
lives in `lib/fonts/` (woff2 + `@font-face` + OFL license per family); rebuild or pull any other
Google font offline with `node scripts/add-font.mjs <id>`. **Never** emit a `fonts.googleapis.com`
link/`@import` (Munich LG ruling 3 O 17493/20).

### Field validation — the recon (lug 2026)

This stack is **confirmed by reverse engineering** of the genre leaders (9 lug 2026: `recon/` +
`docs/gap-analysis-2026-07-09.md` + `docs/dossier-reverse-engineering-web3d.md`): threejs.paris
ships WebGPU+TSL+compute in production on exactly this stack; a "modern site, July 2026" is the
choreography of **three tiers** — editorial (View Transitions, big type: framer.com/poch.studio),
motion-craft (disciplined GSAP+Lenis: ylem.watch), and full 3D (threejs.paris) — and the kit must
compose all three, not only execute tier 3. **Explicit NON-goals** (decided, not forgotten):
anime.js stays out of the core (GSAP is the single motion engine), Theatre.js no, locomotive-scroll
/ Barba / `framer-motion-3d` banned, pmndrs postprocessing only on WebGL2-only builds, Gaussian
splats in R&D. **Open P1s from the gap analysis**: the Next starter twin (also the answer to the
JS-bundle debt), rapier as a real dependency, View Transitions patterns, blueprints 04 + 07–12.

---

## 2. React Bits — the interactive component library (`lib/react-bits/`)

134 production interactive components, **copy-paste, self-contained** (TypeScript + CSS), in 4
families. Full one-line catalog: [`lib/react-bits/CATALOG.md`](lib/react-bits/CATALOG.md).

- **TextAnimations (23)** — SplitText, BlurText, ScrollReveal, ScrollVelocity, GradientText,
  DecryptedText, VariableProximity, TextPressure, ShinyText, CountUp…
- **Animations (30)** — AnimatedContent, Magnet, ClickSpark, SplashCursor, PixelTrail, Ribbons,
  MetaBalls, ElectricBorder, LaserFlow, GlareHover, ImageTrail, TargetCursor…
- **Components (36)** — CardSwap, Carousel, Dock, Masonry, ScrollStack, TiltedCard, MagicBento,
  PillNav, StaggeredMenu, ProfileCard, ModelViewer, Lanyard (rapier), FluidGlass…
- **Backgrounds (45)** — Aurora, Silk, Threads, Galaxy, Iridescence, Plasma, Beams, LiquidEther,
  Prism, Hyperspeed, Particles, Dither, Waves, DarkVeil, LightRays…

**Workflow (React Bits is copy-first by design):** pick from the catalog → copy that component's
folder from `lib/react-bits/<Family>/<Name>/` into the target project's `src/` → install its deps
(varies per component: `gsap`, `motion`, `ogl`, `three`, `@react-three/*`) → tune props. Do **not**
ship all 134 into a site; copy only what's used. See `interactive-components.md`.

**Tech split:** ~30 are `ogl` shader backgrounds (cheap, full-screen), ~8 are R3F/three (Lanyard,
Ballpit, ModelViewer, FluidGlass), the rest are GSAP/Motion DOM effects. Match the component's
engine to the site (don't pull three for a CSS effect).

---

## 2b. The other vendored design shelves (`lib/`) — copy-first, offline, GDPR-safe

The same "copy the folder you need, don't ship the whole shelf" model as React Bits, extended to
four more asset libraries. Each has its own catalog. **All are self-hosted — no runtime CDN.**

- **`lib/componentry/`** — 51 MIT copy-paste React components from [componentry.dev](https://componentry.dev)
  (WebGL/shader backgrounds, magnetic/physics UI, kinetic text, scroll choreography, cards, buttons,
  hero blocks). Deps already in the kit (`motion`/`framer-motion`, `gsap`, some `three`/R3F). DOM/overlay
  layer — *not* inside `<Canvas>`. Assumes Tailwind v4 for its classes. Catalog: `lib/componentry/CATALOG.md`.
  ⚠︎ The npm package literally named `componentry` is **unrelated** — do not install it.
- **`lib/patterns/`** — 87 **Hero Patterns** (Steve Schoger, **CC BY 4.0** — attribution required) as
  themeable SVGs + a zero-dep `heroPattern(name,color,opacity)` helper, plus **pattern.css** (MIT, 56
  classes). Static backdrops behind the canvas or in DOM sections; put text on a scrim. This is the free,
  redistributable answer to **MagicPattern** (proprietary — cannot be vendored). Catalog: `lib/patterns/CATALOG.md`.
- **`lib/fonts/`** — 30 curated self-hosted Google Fonts (woff2 + `@font-face` + OFL license each), grouped
  Sans/Display/Serif/Mono. Add any other family offline with `scripts/add-font.mjs`. Import the family's
  `font.css`; `font-display:swap`; preload the 1–2 hero faces. Catalog: `lib/fonts/FONTS.md`.
- **`lib/illustrations/`** — ~2,960 flat 2D SVG, the free/self-hosted answer to **Blush** (paid SaaS):
  **unDraw** 1362 editorial illustrations (accent themeable via CSS var `--primary-svg-color`; unDraw's own
  license — free/no-attribution but **no repack, no AI-training**), **DiceBear** 1488 (31 styles × 48, tiered
  CC0 / MIT / free / CC BY), **Open Doodles** 33 (CC0), **Humaaans** (CC BY 4.0). For hero/empty-state art or
  UV-mapped onto R3F planes (drei `<Image>`). CC-BY sets + Humaaans require credit — see
  `lib/illustrations/ATTRIBUTION.md`. Catalog: `lib/illustrations/CATALOG.md`.

**Reference-only (nothing to vendor):** **Mobbin** is a paid, login-walled library of copyrighted app
screenshots — see `docs/inspiration/mobbin.md` for a UX pattern taxonomy + links (no assets stored).

Rebuild scripts: `scripts/add-font.mjs` (fonts), `scripts/gen-illustrations.mjs` (illustrations).

---

## 3. How it composes (the hard rules — break these and it fights itself)

1. **One RAF loop.** Lenis driven by `gsap.ticker`; `ScrollTrigger.update` on Lenis scroll;
   R3F renders in the same frame. React Bits components that animate on scroll must read the SAME
   Lenis-smoothed scroll — never add a second `requestAnimationFrame`.
2. **One owner per animated property.** A uniform/camera/DOM value is driven by exactly one place.
3. **DOM motion ≠ 3D motion.** `motion/react` for DOM; `useFrame`/TSL/GSAP for 3D. `framer-motion-3d`
   is dead (breaks React 19).
4. **Accessibility is not optional.** Canvas `aria-hidden`; real controls in focusable DOM;
   `prefers-reduced-motion` honored everywhere (3D *and* React Bits effects); ≥4.5:1 contrast over
   moving backgrounds (use a scrim); 44px targets. Clickable 3D overlays (drei `<Html>`) must portal
   ABOVE the page content or they are not clickable (lesson: see realism reference).
5. **Mobile budget from the start.** dpr cap 2; quality tiers; gate post FX / physics / heavy
   backgrounds off on low tier; recompute tier on resize/orientation.
6. **Degrade, never blank.** WebGPU → WebGL2 → no-WebGL poster. Missing asset → procedural fallback.

---

## 4. Realism — what actually makes 3D look real (most-missed)

Detailed playbook + the WebGPU gotchas in `realism-and-interactivity.md`; the **full cross-cutting research
consolidation** (9 verified findings, reference benchmarks, refuted list) is in
`.claude/skills/web3d-integration-patterns/references/photoreal-3d-research-dossier.md`, and the kit's
improvement plan toward excellence is in repo-root **`ROADMAP.md`**. Headlines:

- **PBR + real textures**: KTX2 (Basis) albedo(sRGB)/normal/roughness, mip-mapped. On WebGPU use
  **three's own `KTX2Loader`** (drei `useKTX2` uses three-stdlib's, which CRASHES on WebGPU).
- **Anti-tiling**: **triplanar** world-space sampling kills the repeating grid + per-face seams that
  scream "fake". Single biggest realism win on tiled surfaces.
- **IBL**: a real HDRI via drei `<Environment>` for image-based lighting + one key sun. Self-host it.
- **Post FX**: bloom + **GTAO** (ambient occlusion) — GTAO writes a single-channel `RedFormat` AO;
  compose `color.mul(vec4(vec3(ao.r),1))` (multiplying the raw texture turns the scene red).
- **Organic form**: break boxy meshes with multi-octave TSL vertex noise; tonal modelling
  (bright sunlit tops, dark shaded sides).
- **Vegetation (hedges/grass/trees) is its own discipline** → see `realistic-foliage.md`. The hard
  truth: a procedural *solid box* with a shader can't look real. The standard is **instanced
  alpha-tested LEAF CARDS** on a leaf atlas (3DTexel / ambientCG, CC0) via native `THREE.InstancedMesh`
  (NOT drei `<Instances>`), with `alphaHash` + **temporal AA (TRAA/SMAA)**, two-sided **transmission**
  for back-lit leaves, and multi-layer TSL **wind**. Realistic ceiling = great *web* foliage
  (Bruno-Simon level), not literal AAA — for pixel-faithful photoreal use video/baked render as the hero.
- **Physics & gesture** for "alive" interactivity: `@react-three/rapier`, `@use-gesture/react`.

---

## 5. Install (what a new site needs)

Core is in the kit `package.json`. Per-site, add only what the chosen components/effects need:

```bash
# 3D realism: drei + WebGPU post (in three) + physics
npm i @react-three/drei @react-three/rapier
# Interactive shader backgrounds (React Bits ogl set)
npm i ogl
# Gestures
npm i @use-gesture/react
# Math helpers for shaders
npm i maath
```

Versions: take the latest stable; the kit pins a verified floor. WebGPU is zero-config since
three r171 / 0.171.
