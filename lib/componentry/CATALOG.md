# Componentry

> Componentry ([componentry.dev](https://componentry.dev), source `harshjdhv/componentry`) is an open
> source collection of copy-paste React components — WebGL/shader backgrounds, magnetic/physics UI,
> kinetic text, scroll-driven blocks, cards, buttons and heroes. It is **copy-paste by design**: you
> do NOT install a package, you take the component you need. 51 items are vendored here offline (MIT).

Important notes for agents:

- **Two ways to get a component:** (a) the vendored source in this shelf,
  `lib/componentry/<name>/<name>.tsx` (+ any sibling files like `webgl-error-boundary.tsx`,
  `ease.ts`), or (b) the shadcn CLI against the registry:
  `npx shadcn@latest add https://componentry.dev/r/<name>.json`. In this kit prefer the vendored
  source — no runtime CDN calls (GDPR: self-host everything).
- **Dependencies vary per component.** They are listed below per item and come from
  `_registry/manifest.json`. Always open the file and check its imports before wiring it in.
- Components are grouped here by theme; the flat registry does not carry these groups.
- **⚠️ WARNING:** the npm package literally named `componentry` is a **DIFFERENT, unrelated** library.
  Do **NOT** `npm install componentry`. This shelf is copy-paste source, not that package.

## Dependencies (read this before installing anything)

- **`framer-motion` vs `motion`.** Most of these components import from **`framer-motion`** (e.g.
  `import { motion } from "framer-motion"`). This kit ships **`motion` 12** (the successor package),
  **not** `framer-motion`. A site using these components either installs `framer-motion` OR rewrites
  the imports to `motion/react` (the same API under the new package name). Pick one and be consistent.
- **Real R3F / three pieces.** A few components pull `three` + `@react-three/fiber` (+ `@react-three/drei`)
  — these are genuine R3F. Most "WebGL" backgrounds here instead use **raw WebGL** (a `<canvas>` +
  GLSL strings, no three), so they carry **no** npm deps at all.
- **Other libs seen:** `lucide-react` (icons), `clsx` + `tailwind-merge` (the `cn()` helper),
  `cmdk` (command menu), `opentype.js` (signature path tracing), `lenis` (sticky-scroll-cards), and
  **`gsap`** for the GSAP pieces (`image-trail`, `layered-stack`) even though the manifest omits it —
  they `import ... from "gsap"`, so install `gsap` too.
- **Tailwind CSS v4 assumed.** Every component styles itself with Tailwind utility classNames and a
  `cn()` helper (usually imported as `@/lib/utils` or `@workspace/ui/lib/utils` — repoint that import).
  This kit has **no Tailwind by default**: the source copies cleanly, but the styling needs Tailwind
  installed OR manual adaptation to plain CSS.

CLI form for any item: `npx shadcn@latest add https://componentry.dev/r/<name>.json`

---

## WebGL / Shader backgrounds

Full-screen animated backdrops. Unless flagged **(R3F)**, these are raw-WebGL (a `<canvas>` + GLSL,
**no npm deps**) and ship a sibling `webgl-error-boundary.tsx` with a non-WebGL fallback.

- **animated-gradient** — Flowing animated gradient field on a WebGL canvas with error-boundary fallback. *Deps: none.*
- **silk-aurora** — Silky aurora shader with mouse-reactive flow, speed and intensity uniforms. *Deps: none.*
- **liquid-chrome** — Reflective liquid-chrome shader surface with base-color tint and optional mouse interaction. *Deps: none.*
- **closing-plasma** — Premium plasma background with customizable motion, palette, sparkle and interaction. *Deps: clsx, tailwind-merge.*
- **webgl-liquid** — Premium WebGL liquid hero background with customizable flow, palette, reveal and grain. *Deps: clsx, tailwind-merge.*
- **dither-gradient** — Animated dithered gradient using a canvas Bayer-matrix dither. *Deps: none.*
- **matrix-rain** — Matrix-style falling-glyph rain on a 2D canvas, with color variants. *Deps: none.*
- **noise-texture** — Animated noise/grain texture overlay with adjustable grain size and blend modes. *Deps: none.*
- **liquid-blob** — Animated morphing liquid-blob shapes with mouse interaction for an organic backdrop. *Deps: framer-motion.*
- **particle-galaxy** **(R3F)** — Spiral-arm particle galaxy with mouse influence, auto-rotation and blend modes. *Deps: three.*
- **dither-prism-hero** **(R3F)** — WebGL hero: advanced dithering + prismatic refraction + holographic iridescence + center ripple. *Deps: @react-three/fiber, @react-three/drei, three, framer-motion.*
- **image-ripple-effect** **(R3F)** — Cursor-driven WebGL ripple distortion applied to image cards. *Deps: three, @types/three, @react-three/fiber, @react-three/drei.*

## Magnetic / physics UI

Cursor-reactive, spring-driven interactive elements.

- **magnetic-dock** — macOS-style dock with magnetic scaling and spring physics; light/dark modes. *Deps: framer-motion.*
- **magnet-lines** — Grid of lines that rotate to face the cursor for a magnetic-field effect. *Deps: framer-motion.*
- **text-repel** — Letters push away from (or pull toward) the cursor within a radius. *Deps: none (imports framer-motion).*
- **eye-tracking** — Pair of eyes whose pupils follow the cursor, with configurable colors and glint. *Deps: none (imports framer-motion).*
- **cursor-driven-particle-typography** — Text rendered as a particle cloud on canvas that reacts to the cursor. *Deps: none.*

## Kinetic / animated text

Headline, word and character effects.

- **text-animate** — Flexible text-animation primitive (per char/word/line, enter/exit, stagger). *Deps: framer-motion.*
- **kinetic-text-reveal** — Directional reveal with soft blur and word/character/line stagger timing. *Deps: framer-motion.*
- **letter-cascade** — Spring-based letter cascade with configurable stagger origin and bounciness. *Deps: none (imports framer-motion).*
- **hyper-text** — Cyberpunk scramble: cycles random characters before resolving to the final text. *Deps: none.*
- **split-flap-display** — Airport/train split-flap board that flips characters into place. *Deps: none.*

## Scroll-driven

Effects bound to scroll progress. Mind the single-loop rule (see README).

- **scroll-based-velocity** — Marquee text that skews and speeds up with the user's scroll velocity. *Deps: framer-motion.*
- **scroll-choreography** — Four corner images choreographed by scroll progress. *Deps: none (imports framer-motion).*
- **scroll-split-card** — Card content splits/reveals as it scrolls into view. *Deps: none (imports framer-motion).*
- **sticky-scroll-cards** — Stacked cards that pin and transition on scroll. *Deps: framer-motion, lenis.*
- **collection-surfer** — Scroll-driven image collection with magnetic/uplift/simple variants. *Deps: none (imports framer-motion).*
- **layered-stack** — Grid of cards that animate between a stacked and a spread layout. *Deps: none (imports gsap).*

## Cards & UI blocks

Reusable interface building blocks and widgets.

- **spotlight-card** — Cards with a cursor-following spotlight, animated gradient border and 3D tilt. *Deps: none.*
- **showcase-card** — Showcase card with 3D tilt, parallax image and micro-interactions; multiple variants. *Deps: framer-motion.*
- **orbit-card-stack** — Hover card deck that fans outward and lifts the active card. *Deps: framer-motion, lucide-react.*
- **image-trail** — Cursor-driven trail of images with easing variants. *Deps: none (imports gsap).*
- **infinite-image-field** — Endless cursor-panned photo canvas tiling infinitely in all directions. *Deps: none.*
- **pixel-canvas** — Interactive pixel grid that lights on hover and decays with a trailing effect. *Deps: none.*
- **circuit-board** — Interactive circuit-board layout with pulsing electricity paths; theme-aware. *Deps: framer-motion.*
- **bouncy-accordion** — Accordion with a bouncy spring expand/collapse. *Deps: framer-motion, lucide-react.*
- **command-menu** — macOS Spotlight-style command palette with search and keyboard nav. *Deps: cmdk, framer-motion, lucide-react.*
- **auth-modal** — Animated authentication modal with social-login options. *Deps: framer-motion, lucide-react.*
- **flight-status-card** — Flight-status widget with dot-matrix airport codes, progress and ETA. *Deps: framer-motion.*
- **github-calendar** — GitHub contribution-graph visualization with variants and scaling. *Deps: framer-motion.*
- **testimonial-marquee** — Infinite scrolling marquee for testimonials / social proof. *Deps: framer-motion.*
- **music-player** — Animated music-player UI widget. *Deps: none (imports framer-motion).*
- **mac-keyboard** — Rendered macOS keyboard UI. *Deps: none.*
- **scrub-input** — Pill-styled inline slider ("scrub") input for smoothly adjusting a variable. *Deps: none.*
- **signature** — Animated handwritten signature that traces a font outline as a path. *Deps: framer-motion, opentype.js.*
- **border-beam** — Gradient beam that travels along the border of its container. *Deps: framer-motion.*

## Buttons

- **interactive-hover-button** — Button that reveals text and an arrow icon on hover. *Deps: lucide-react.*
- **shimmer-button** — Button with a moving shimmer light sweep. *Deps: none.*
- **pulsating-button** — Button with a pulsating glow. *Deps: none.*

## Hero blocks

- **gradient-hero-01** — Centered hero with a warm cinematic gradient, badge, copy and two actions. *Deps: none.*
- **hero-geometric** **(R3F)** — Geometric hero section with a shader background and premium type. *Deps: framer-motion, lucide-react, three, @react-three/fiber, @react-three/drei.*

## Image effects

- **image-ripple-effect** **(R3F)** — see *WebGL / Shader backgrounds*. *Deps: three, @types/three, @react-three/fiber, @react-three/drei.*
- **image-trail** — see *Cards & UI blocks*. *Deps: none (imports gsap).*
- **infinite-image-field** — see *Cards & UI blocks*. *Deps: none.*

## Overlays

- **noise-texture** — Animated grain overlay to layer over content. *Deps: none.*
- **command-menu** — Full-screen command palette overlay (also listed under Cards & UI blocks). *Deps: cmdk, framer-motion, lucide-react.*
- **auth-modal** — Modal overlay (also listed under Cards & UI blocks). *Deps: framer-motion, lucide-react.*
