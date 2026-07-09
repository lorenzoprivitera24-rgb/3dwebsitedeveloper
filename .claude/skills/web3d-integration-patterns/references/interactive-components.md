# Interactive components — React Bits (June 2026)

The kit vendors **React Bits** (134 components) in `lib/react-bits/` as the interactivity layer.
This is how an agent picks and wires them. Catalog: `lib/react-bits/CATALOG.md`. Library usage:
`lib/react-bits/README.md`. Stack context: `STACK.md`.

## When to reach for it
Whenever the brief wants the page to feel alive: animated headlines, scroll reveals, cursor effects,
animated nav/menus, galleries/carousels, or a full-screen animated background. Don't hand-roll what
React Bits already ships well — copy and tune.

## The four families (pick by intent)
- **TextAnimations** — make a headline/word/character move: `SplitText`, `BlurText`, `ScrollReveal`,
  `ScrollVelocity`, `GradientText`, `ShinyText`, `DecryptedText`, `TextType`, `VariableProximity`,
  `CountUp`, `RotatingText`.
- **Animations** — cursor/scroll/hover effects & canvas toys: `AnimatedContent` (scroll/mount reveal
  wrapper — the workhorse), `Magnet`, `ClickSpark`, `SplashCursor`, `TargetCursor`, `GlareHover`,
  `PixelTrail`, `ImageTrail`, `Ribbons`, `MetaBalls`, `ElectricBorder`, `LaserFlow`, `StarBorder`.
- **Components** — UI building blocks: `CardSwap`, `Carousel`, `Dock`, `Masonry`, `ScrollStack`,
  `TiltedCard`, `MagicBento`, `SpotlightCard`, `PillNav`, `StaggeredMenu`, `BubbleMenu`, `CardNav`,
  `ProfileCard`, `Stepper`, `ModelViewer` (GLB viewer), `Lanyard` (rapier physics).
- **Backgrounds** — full-screen backdrops: `Aurora`, `Silk`, `Threads`, `Galaxy`, `Iridescence`,
  `Plasma`, `Beams`, `LiquidEther`, `Prism`, `Hyperspeed`, `Particles`, `Waves`, `Dither`,
  `DarkVeil`, `LightRays`, `Lightning`, `GridMotion`, `Ballpit` (R3F physics).

## The copy workflow (React Bits is copy-first, not a dependency)
1. Read `lib/react-bits/CATALOG.md`, pick by the one-line descriptions.
2. Copy `lib/react-bits/<Family>/<Name>/` → the site's `src/`. Each is `Name.tsx` (+ `Name.css`),
   self-contained.
3. Check imports → install only that component's deps:
   - `gsap` / `motion/react` → DOM effect (cheap, most Text/Animations)
   - `ogl` → lightweight WebGL background (most Backgrounds — no three needed)
   - `three` / `@react-three/*` → full three (Lanyard, Ballpit, ModelViewer, FluidGlass)
4. Tune props; wire it.

## Integration rules (or it fights the host)
- **One scroll loop.** A scroll-reactive component must read the host's Lenis-smoothed scroll
  (bind GSAP ScrollTrigger to the existing Lenis); never add a second `requestAnimationFrame`.
- **Kill only your own triggers.** A copied component's cleanup must NEVER call
  `ScrollTrigger.getAll().forEach(t => t.kill())` — that destroys every trigger on the page,
  including the kit's scroll driver. Keep references to the tweens the component created and kill
  those (`tween.scrollTrigger?.kill(); tween.kill()`). The vendored `ScrollReveal` upstream had
  exactly this bug; our copy is patched — re-apply the patch if you re-vendor. Audit every scroll
  component you copy for this pattern BEFORE wiring it.
- **Use the page scroller.** With the kit's Lenis in `root` mode the native window scroll is the
  source of truth, so ScrollTrigger's default `scroller: window` is correct — don't pass a custom
  `scrollContainerRef` unless the host actually scrolls a wrapper element.
- **Reduced motion.** Gate every effect on `prefers-reduced-motion` — keep the content, drop the
  motion. Backgrounds especially must calm down.
- **Contrast.** Animated backgrounds are busy and moving → text on a scrim, ≥4.5:1, 44px targets.
- **Budget.** One background at a time; gate `ogl`/three backgrounds and heavy cursor canvases OFF
  on the low tier / mobile. Don't pull `three` for a CSS effect.
- **a11y of canvas overlays.** If a 3D-positioned element must be clickable, it needs real DOM above
  the content (portal) — see `realism-and-interactivity.md` §C.4.

## Composing with the 3D scene
React Bits backgrounds and the kit's persistent 3D canvas are alternatives, not stacked: a heavy
`ogl` background AND a three scene both fighting for GPU is a budget mistake. Use React Bits
backgrounds for DOM-only/no-3D sites; use the kit's WebGPU canvas when the brief is a 3D experience.
Text/Animations/Components from React Bits layer happily over EITHER.

## The other vendored shelves (same copy-first model)

React Bits is not the only shelf. All are self-hosted, offline, GDPR-safe (no runtime CDN). See
`STACK.md` §2b; each has its own catalog.

- **`lib/componentry/`** (51, MIT — [componentry.dev](https://componentry.dev)) — a second component
  shelf that *complements* React Bits: strong on WebGL/shader backgrounds (`liquid-chrome`, `webgl-liquid`,
  `silk-aurora`, `dither-prism-hero`), magnetic/physics UI (`magnetic-dock`, `magnet-lines`, `text-repel`),
  kinetic text, and scroll choreography. Copy `lib/componentry/<name>/` into `src/`; deps are mostly
  `framer-motion` (the kit ships `motion` — install `framer-motion` or rewrite imports to `motion/react`),
  a few genuine `@react-three/*`+`three` (`dither-prism-hero`, `hero-geometric`, `image-ripple-effect`,
  `particle-galaxy`). Most "WebGL" pieces are raw `<canvas>`+GLSL with zero deps. **Assumes Tailwind v4**
  for classNames — the kit has none by default, so either add Tailwind or adapt the classes. DOM/overlay
  layer, not inside `<Canvas>`. Same budget rule: don't stack a heavy Componentry WebGL background over the
  running WebGPU canvas. ⚠︎ npm `componentry` is an unrelated package — don't install it. Catalog:
  `lib/componentry/CATALOG.md`.
- **`lib/patterns/`** — static section backdrops (not animated): 87 **Hero Patterns** SVGs (**CC BY 4.0**,
  attribution required) via the zero-dep `heroPattern(name,color,opacity)` helper, + **pattern.css** (MIT).
  Cheap, themeable, zero GPU cost — the calm backdrop behind a hero or a DOM section. Text on a scrim. This
  is the vendored answer to MagicPattern (proprietary — not vendorable). Catalog: `lib/patterns/CATALOG.md`.
- **`lib/fonts/`** — 30 self-hosted Google Fonts (woff2 + `@font-face` + OFL). Import a family's `font.css`,
  set `font-family`, `font-display:swap`, preload the hero face. Add any other of ~1,900 offline with
  `node scripts/add-font.mjs <id>`. **Never** the `fonts.googleapis.com` CDN (GDPR). Catalog: `lib/fonts/FONTS.md`.
- **`lib/illustrations/`** — ~2,960 SVG: **unDraw** (1362 editorial), **DiceBear** (1488, 31 styles),
  **Open Doodles** (33 CC0) + **Humaaans** — flat 2D spot art for
  hero/empty/onboarding states, or UV-mapped onto an R3F plane (drei `<Image>` / SVG→texture). Tiered by
  license; **CC-BY sets require credit** → `lib/illustrations/ATTRIBUTION.md`. The vendored answer to Blush
  (paid SaaS). Catalog: `lib/illustrations/CATALOG.md`.

**Mobbin** is reference-only — a paid library of copyrighted app screenshots, nothing to vendor. Use it to
decide *what* to build (UX pattern taxonomy + links in `docs/inspiration/mobbin.md`), then build it from these shelves.
