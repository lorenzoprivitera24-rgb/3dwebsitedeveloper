# Patterns

> An offline shelf of SVG/CSS background patterns — the free, self-hostable answer to MagicPattern.
> MagicPattern's generators are proprietary and its ToS forbids bulk-copying its output, so instead
> of vendoring it we vendor two open, redistributable equivalents: **Hero Patterns** (87 seamless SVG
> tiles) and **pattern.css** (CSS-only geometric utilities). Both render as static backdrops behind
> the R3F `<Canvas>` or in ordinary DOM sections — **zero WebGPU cost** — and theme via CSS
> variables / `currentColor`.

**Attribution (required):** Patterns by Steve Schoger — heropatterns.com — CC BY 4.0.

Important notes for agents:

- These are **static backdrops**, not shaders. Use them in the DOM/overlay layer (behind text, in
  section backgrounds, behind the canvas). They cost nothing on the GPU and never touch the RAF loop.
- Two independent shelves with different mechanisms: **hero-patterns/** is data-URI SVG applied as a
  `background-image` (themeable via the `heroPattern()` helper); **pattern-css/** is pure CSS classes
  that paint with `background-color` + gradients (themeable via `color` / `background-color`).
- Patterns sit **behind** content. Anything with text on top needs a scrim and ≥4.5:1 contrast — see
  the a11y note below. They are decorative: keep them out of the accessibility tree (`aria-hidden`).
- **No runtime CDN.** Everything here is self-hosted (GDPR). Do not swap in the unpkg pattern.css or a
  hosted MagicPattern URL — copy the vendored files.
- MagicPattern's own generators are **inspiration-only** — proprietary, not vendored. Don't scrape or
  re-host their output.

## Shelves

| Folder | Source | License | Count | What |
|---|---|---|---|---|
| `hero-patterns/` | Hero Patterns (Steve Schoger) | CC BY 4.0 (attribution required) | 87 | seamless SVG tile patterns, themeable data-URIs |
| `pattern-css/` | pattern.css (Riz / bansal.io) | MIT | 12 families × 4 sizes | CSS-only geometric utility classes |

## hero-patterns/ — usage

Files in `hero-patterns/`:

- `svg/<name>.svg` — standalone tile (default color `#9C92AC`, opacity `0.4`). Drop-in `background-image`.
- `patterns.json` — themeable data-URIs with `FILLCOLOR` / `FILLOPACITY` placeholders.
- `patterns.js` — the source array.
- `heroPattern.js` — zero-dep ESM helper: `heroPattern(name, color, opacity) -> CSS background-image string`.

Themed via the helper (recommended — one line, any color/opacity):

```js
import { heroPattern } from '../../lib/patterns/hero-patterns/heroPattern.js';

// Themed backdrop for a DOM section, using a CSS var for the color:
section.style.backgroundImage = heroPattern('topography', '#6366f1', 0.35);
```

Or static, straight from the SVG file (uses the built-in `#9C92AC` @ 0.4):

```css
.hero { background-image: url('../../lib/patterns/hero-patterns/svg/topography.svg'); }
```

### The 87 Hero Patterns

`anchors-away`, `architect`, `autumn`, `aztec`, `bamboo`, `bank-note`, `bathroom-floor`, `bevel-circle`,
`boxes`, `brick-wall`, `bubbles`, `cage`, `charlie-brown`, `church-on-sunday`, `circles-squares`,
`circuit-board`, `connections`, `cork-screw`, `current`, `curtain`, `cutout`, `death-star`,
`diagonal-lines`, `diagonal-stripes`, `dominos`, `endless-clouds`, `eyes`, `falling-triangles`,
`fancy-rectangles`, `flipped-diamonds`, `floating-cogs`, `floor-tile`, `formal-invitation`,
`four-point-stars`, `glamorous`, `graph-paper`, `groovy`, `happy-intersection`, `heavy-rain`,
`hexagons`, `hideout`, `houndstooth`, `i-like-food`, `intersecting-circles`, `jigsaw`, `jupiter`,
`kiwi`, `leaf`, `lines-in-motion`, `lips`, `lisbon`, `melt`, `moroccan`, `morphing-diamonds`,
`overcast`, `overlapping-circles`, `overlapping-diamonds`, `overlapping-hexagons`, `parkay-floor`,
`piano-man`, `pie-factory`, `pixel-dots`, `plus`, `polka-dots`, `rails`, `rain`,
`random-shapes`, `rounded-plus-connected`, `signal`, `skulls`, `slanted-stars`, `squares`,
`squares-in-squares`, `stamp-collection`, `steel-beams`, `stripes`, `temple`, `texture`,
`tic-tac-toe`, `tiny-checkers`, `topography`, `volcano-lamp`, `wallpaper`, `wiggle`, `x-equals`,
`yyy`, `zig-zag`

## pattern-css/ — usage

Files in `pattern-css/`: `pattern.css` (readable), `pattern.min.css` (ship this), `pattern.scss` (source).

Pure CSS: import once, then compose a `pattern-<name>-<size>` class with a foreground `color` and a
`background-color`. The pattern is drawn in `color`; the field is the `background-color`.

```html
<link rel="stylesheet" href="../../lib/patterns/pattern-css/pattern.min.css" />

<!-- foreground pattern = currentColor; field = background -->
<div class="pattern-dots-md" style="color: #6366f1; background: #0b0b12;">…</div>
```

Sizing helpers `pattern-w-{sm,md,lg,xl}` / `pattern-h-{sm,md,lg,xl}` set fixed width/height
(10/25/50/100px); `text-pattern` clips a pattern to text via `background-clip: text`.

### Pattern class families (each × `-sm` `-md` `-lg` `-xl`)

- `pattern-checks-*`
- `pattern-grid-*`
- `pattern-dots-*`
- `pattern-cross-dots-*`
- `pattern-diagonal-lines-*`
- `pattern-horizontal-lines-*`
- `pattern-vertical-lines-*`
- `pattern-diagonal-stripes-*`
- `pattern-horizontal-stripes-*`
- `pattern-vertical-stripes-*`
- `pattern-triangles-*`
- `pattern-zigzag-*`

Helpers: `pattern-w-{sm,md,lg,xl}`, `pattern-h-{sm,md,lg,xl}` (sizing), `text-pattern` (clip to text).

## Licenses

- **Hero Patterns** — CC BY 4.0. **Attribution is required** wherever these ship: *Patterns by Steve
  Schoger — heropatterns.com — CC BY 4.0.* Keep the credit in `heroPattern.js` intact.
- **pattern.css** — MIT (Riz / bansal.io). Keep the license/copyright notice.

## Accessibility

Patterns are decorative and busy. Behind text they **must** have a scrim (a solid or semi-opaque
layer between the pattern and the text) so the text keeps ≥4.5:1 contrast. Lower `FILLOPACITY` (Hero
Patterns) or pick a low-contrast `color`/`background` pair (pattern.css) for text backgrounds. Mark
the pattern element `aria-hidden` / keep it out of the tab order — it carries no meaning.

## Notes for agents

- Prefer **hero-patterns** when you want an organic, illustrative texture (topography, hexagons,
  circuit-board…) themed to a brand color; prefer **pattern.css** for crisp geometric grids/dots/
  stripes that scale by size class.
- Both are DOM-layer decoration — never render them inside the `<Canvas>` and never let them add a
  RAF loop. They are inert.
- Contrast + `aria-hidden` are part of "done" for any pattern behind text.
