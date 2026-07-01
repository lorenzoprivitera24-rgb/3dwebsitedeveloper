# Patterns — vendored offline background-pattern shelf

An offline shelf of SVG/CSS background patterns — the free, self-hostable answer to
[MagicPattern](https://www.magicpattern.design/). MagicPattern is proprietary and its ToS forbids
bulk-copying its generated output, so instead of vendoring it we ship two open, redistributable
equivalents. Both render as **static backdrops** behind the R3F `<Canvas>` or in ordinary DOM
sections — **zero WebGPU cost**, no RAF loop, and themeable via CSS vars / `currentColor`.

See [`CATALOG.md`](CATALOG.md) for the full list (87 pattern names + the pattern.css class families).

## What's here

| Folder | Source | License | What |
|---|---|---|---|
| `hero-patterns/` | Hero Patterns (Steve Schoger) | CC BY 4.0 (attribution required) | 87 seamless SVG tiles, themeable data-URIs + a zero-dep helper |
| `pattern-css/` | pattern.css (Riz / bansal.io) | MIT | 12 geometric families × 4 sizes, pure CSS classes |

## How to use it

**hero-patterns** — themed SVG via the `heroPattern()` helper (recommended):

```js
import { heroPattern } from '../../lib/patterns/hero-patterns/heroPattern.js';
// heroPattern(name, color, opacity) -> a CSS background-image string
el.style.backgroundImage = heroPattern('hexagons', '#6366f1', 0.3);
```

**pattern.css** — pure CSS class; the pattern paints in `color`, over `background-color`:

```html
<link rel="stylesheet" href="../../lib/patterns/pattern-css/pattern.min.css" />
<div class="pattern-dots-md" style="color:#6366f1; background:#0b0b12;">…</div>
```

> Do not ship all 87 SVGs / the whole CSS into a site blindly. Copy the file(s) you use — this is a
> reference shelf. And **no runtime CDN**: self-host the vendored files (GDPR), never link unpkg or a
> hosted MagicPattern URL.

## Licenses

- **Hero Patterns** — **CC BY 4.0, attribution required.** Keep this credit wherever they ship:
  *Patterns by Steve Schoger — heropatterns.com — CC BY 4.0.* (The notice is already in
  `hero-patterns/heroPattern.js` — leave it intact.)
- **pattern.css** — **MIT** (Riz / bansal.io). Keep the license/copyright notice.

## Accessibility / contrast

Patterns are decorative and busy. Behind text they **need a scrim** — a solid or semi-opaque layer
between the pattern and the text — so the text keeps ≥4.5:1 contrast. Lower `FILLOPACITY`
(hero-patterns) or choose a low-contrast `color`/`background` pair (pattern.css) for text
backgrounds, and mark the pattern element `aria-hidden` (it carries no meaning, keep it out of the
tab order).

## Note on MagicPattern

MagicPattern's own generators are **inspiration-only** — proprietary and copyrighted, nothing is
vendored from it. Use it to sketch a look, then reproduce it with these open shelves. Don't scrape or
re-host its output.
