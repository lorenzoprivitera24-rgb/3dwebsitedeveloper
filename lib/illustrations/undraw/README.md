# unDraw — editorial SVG illustrations (1,362, self-hosted)

Open-source editorial illustrations by Katerina Limpitsouni ([undraw.co](https://undraw.co)) — the
big, "real scene" complement to the DiceBear avatar remixes. 1,362 SVGs in `svg/`, fully offline
(no runtime CDN). **License is NOT MIT — see [`LICENSE.md`](LICENSE.md)** (free + no attribution, but
no repackaging and no AI-training).

## Theming — one accent color, one CSS variable

Every unDraw illustration has a single **accent color**, exposed here as the CSS custom property
`--primary-svg-color` (this mirror already rewrote the original `#6c63ff` to the variable). Theme the
whole set with one rule — no per-file edits:

```css
:root { --primary-svg-color: #ff5a1f; } /* your brand accent — applies to every inlined unDraw SVG */
```

The variable only resolves when the SVG is **inlined into the DOM** (e.g. imported as a React component,
or `?raw` + `dangerouslySetInnerHTML`). If you reference an SVG via `<img src>` / `background-image`,
the external file can't read the page's CSS variable — in that case give it a default fill by editing
the file, or inline it. The non-accent colors (greys, skin tones, secondary blues) are intentional —
don't blanket-replace all hex values.

```tsx
// Vite: inline so the CSS variable applies + it stays self-hosted
import svg from '../lib/illustrations/undraw/svg/a-moment-to-relax.svg?raw';
<div style={{ ['--primary-svg-color']: 'var(--brand)' }} dangerouslySetInnerHTML={{ __html: svg }} />
```

## Use in the 3D kit
Flat 2D vector — ideal for hero/section art, empty/error/onboarding states, feature blocks, or
UV-mapped onto an R3F plane (rasterize the SVG → texture, or drei `<Image>`). Zero WebGPU cost as DOM.

## Re-vendor / update
```bash
git clone --depth 1 https://github.com/balazser/undraw-svg-collection.git /tmp/undraw-src
cp /tmp/undraw-src/svgs/*.svg lib/illustrations/undraw/svg/   # do NOT copy the mirror's (mislabeled) LICENSE
```
Alt mirror with the literal `#6c63ff` accent (for find-and-replace instead of a CSS var):
`github.com/cuuupid/undraw-illustrations` (~417, older/smaller set).
