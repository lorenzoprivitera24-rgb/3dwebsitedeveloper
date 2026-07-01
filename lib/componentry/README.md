# Componentry — vendored copy-paste component shelf

51 copy-paste React components from [componentry.dev](https://componentry.dev)
(source `harshjdhv/componentry`), vendored here offline as a **DOM-layer** design shelf: WebGL/shader
backgrounds, magnetic/physics UI, kinetic text, scroll-driven blocks, cards, buttons and heroes.
See [`../../STACK.md`](../../STACK.md) for how this fits the stack.

> **⚠️ Not the npm package.** The npm package literally named `componentry` is a **different, unrelated**
> library. Do **NOT** `npm install componentry`. This shelf is copy-paste source.

## How to use it (copy-first)

Componentry is **copy-paste by design** — you do NOT depend on a package, you take the component you
need. For a new site:

1. **Browse** [`CATALOG.md`](CATALOG.md) (all 51 grouped by theme + a one-line description + deps).
2. **Copy** the component folder into the target project:
   `lib/componentry/<name>/` → `src/<wherever>/`. Grab the sibling files too — several ship a
   `webgl-error-boundary.tsx` (the non-WebGL fallback) or an `ease.ts`; the folder is self-contained.
3. **Install its deps.** They vary per component — open the `.tsx` and check the imports (the manifest
   under-reports: `image-trail` / `layered-stack` import `gsap`, several import `framer-motion`
   without listing it). Common ones:
   - `from "framer-motion"` → DOM animation. **This kit ships `motion` 12, not `framer-motion`.**
     Either `npm i framer-motion`, or rewrite the imports to `motion/react` (same API, new name).
   - `from "three"` / `"@react-three/*"` → real R3F (only `dither-prism-hero`, `hero-geometric`,
     `image-ripple-effect`, `particle-galaxy`). Most other "WebGL" pieces use raw `<canvas>` + GLSL,
     **no** deps.
   - `from "cmdk" | "opentype.js" | "lenis" | "lucide-react" | "clsx" | "tailwind-merge"` as noted per
     component in the catalog.
4. **It assumes Tailwind CSS v4.** Every component styles itself with Tailwind classNames and a `cn()`
   helper (imported as `@/lib/utils` or `@workspace/ui/lib/utils` — repoint that import to your own
   `cn`). **This kit has no Tailwind by default:** the source copies cleanly, but you must either add
   Tailwind or adapt the classNames to plain CSS.
5. **Tune props** and wire it in.

> Do not ship all 51 into a site. Copy only what's used — this is a reference shelf, not a runtime dependency.

## Integration rules (don't break the host site)

- **DOM/overlay layer, not the canvas.** These are DOM components. Render them in the overlay layer
  **above** the R3F `<Canvas>` — never inside it. `motion.*` is DOM-only (and `framer-motion-3d` is
  banned kit-wide).
- **Mind perf over the running WebGPU canvas.** The heavy WebGL pieces (`particle-galaxy`,
  `dither-prism-hero`, `image-ripple-effect`, `webgl-liquid`, `closing-plasma`, `silk-aurora`,
  `liquid-chrome`, `animated-gradient`) each spin their own GL/canvas context on top of the kit's
  main WebGPU canvas. Don't stack several; gate them off on the low-quality tier / mobile.
- **One scroll loop.** Scroll-reactive components (`sticky-scroll-cards` bundles its own `lenis`,
  plus the `scroll-*` and `collection-surfer` pieces) must read the host's Lenis-smoothed scroll, not
  spin a second RAF. Reuse the existing Lenis + `gsap.ticker`; don't mount a second `ReactLenis`.
- **Reduced motion.** These components do **not** honor `prefers-reduced-motion` out of the box —
  gate the animation yourself (skip the effect / render static content) when the user prefers reduced
  motion.
- **No runtime CDN.** Some sources hardcode Unsplash image URLs as demo data (`collection-surfer`,
  `infinite-image-field`, …). Replace them with self-hosted assets — no third-party CDN at runtime (GDPR).

## License

**MIT** (componentry.dev / `harshjdhv/componentry`). The GSAP-based pieces (`image-trail`,
`layered-stack`) additionally use GSAP, which ships under its own now-free license — keep it. Retain
attribution where required.

## Re-syncing

Re-pull from the registry to refresh this shelf: for each item run
`npx shadcn@latest add https://componentry.dev/r/<name>.json` (names are in
[`CATALOG.md`](CATALOG.md) / `_registry/manifest.json`), or re-copy a fresh `harshjdhv/componentry`
checkout into `lib/componentry/`. Keep `_registry/manifest.json` and this catalog in sync when the
set changes.
