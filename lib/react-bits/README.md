# React Bits — vendored interactive component library

134 copy-paste, self-contained interactive components (TypeScript + CSS variant) from
[reactbits.dev](https://www.reactbits.dev), vendored here as the kit's **interactivity layer**.
See [`../../STACK.md`](../../STACK.md) for how this fits the stack.

## How to use it (copy-first)

React Bits is **copy-paste by design** — you do NOT depend on a package, you take the component you
need. For a new site:

1. **Browse** [`CATALOG.md`](CATALOG.md) (every component + a one-line description + family).
2. **Copy** the component folder into the target project:
   `lib/react-bits/<Family>/<Name>/` → `src/<wherever>/`. Each folder is `Name.tsx` (+ `Name.css`),
   self-contained (no internal cross-imports).
3. **Install its deps.** They vary per component — open the file and check the imports:
   - `from 'gsap'` / `'motion/react'` → DOM animation (most Animations + TextAnimations)
   - `from 'ogl'` → lightweight WebGL background (most Backgrounds)
   - `from 'three'` / `'@react-three/*'` → full three/R3F (Lanyard, Ballpit, ModelViewer, FluidGlass)
4. **Tune props** and wire it in.

> Do not ship all 134 into a site. Copy only what's used — this is a reference shelf, not a runtime dependency.

## Families

| Folder | Count | What |
|---|---|---|
| `TextAnimations/` | 23 | headline/word/character effects (SplitText, ScrollReveal, GradientText, DecryptedText…) |
| `Animations/` | 30 | cursor/scroll/hover effects + canvas toys (Magnet, ClickSpark, SplashCursor, Ribbons, MetaBalls…) |
| `Components/` | 36 | UI building blocks (CardSwap, Carousel, Dock, Masonry, ScrollStack, TiltedCard, PillNav…) |
| `Backgrounds/` | 45 | full-screen animated backdrops (Aurora, Silk, Galaxy, Iridescence, Plasma, Beams, LiquidEther…) |

## Integration rules (don't break the host site)

- **One scroll loop.** Scroll-reactive components (ScrollReveal, ScrollVelocity, ScrollStack…) must
  read the host's Lenis-smoothed scroll, not spin a second RAF. Prefer GSAP ScrollTrigger bound to
  the existing Lenis.
- **Reduced motion.** Every effect must honor `prefers-reduced-motion` — gate the animation, keep the
  content. Many components accept a prop; otherwise wrap.
- **Contrast over backgrounds.** Animated backgrounds (Backgrounds/*) move and are busy — put text on
  a scrim and keep ≥4.5:1.
- **Engine match.** Don't pull `three` for a CSS/Motion effect, and don't stack two heavy `ogl`
  backgrounds. Gate heavy effects off on the low quality tier / mobile.
- **License:** React Bits is MIT (see reactbits.dev). Keep attribution where required.

## Updating

Re-vendor from a fresh `react-bits` checkout: copy `src/ts-default/{TextAnimations,Animations,Components,Backgrounds}`
here and `public/llms.txt` → `CATALOG.md`. (A Tailwind variant exists upstream as `ts-tailwind/` if a
project uses Tailwind instead of plain CSS.)
