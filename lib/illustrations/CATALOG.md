# Illustrations

> Offline SVG illustration shelf — the free, redistributable answer to [Blush](https://blush.design).
> Blush is a paid SaaS: art is served as PNG, one image at a time, behind a subscription, and cannot
> be bulk-downloaded or self-hosted. So instead of vendoring Blush, we vendor the **open sets the same
> creators and community actually published** — unDraw's editorial scenes, DiceBear's 31 avatar/doodle/
> abstract styles, Pablo Stanley's Open Doodles and Humaaans — all generated/mirrored locally so nothing
> loads from a third-party CDN at runtime.

Important notes for agents:

- **Everything here is flat 2D SVG.** No WebGL, no runtime deps. Drop straight into the DOM/overlay
  layer, or texture onto the R3F `<Canvas>` layer (see "How to use").
- **Four sources, four directories:** `undraw/` (1362 editorial scene SVGs), `dicebear/` (1488
  generated avatar/doodle SVGs, 31 styles × 48 deterministic variants), `open-doodles/` (33 hand-drawn
  scene doodles) and `humaaans/` (mix-and-match editorial people, SVG + PNG).
- **Grand total: 2883 SVG** (1488 DiceBear + 1362 unDraw + 33 Open Doodles) **plus Humaaans** (79 SVG +
  158 PNG). unDraw is the big "real scene" editorial set; the rest are people/avatars and abstract marks.
- **Three tiers of shipping obligation, not one look** — the tier decides what you owe on ship:
  (i) **no-attribution & unrestricted** (CC0 / MIT / free-P+C DiceBear + Open Doodles CC0); (ii)
  **no-attribution BUT restricted** (unDraw — no repackaging as a pack, no AI/ML training); (iii)
  **attribution required** (the 13 CC BY 4.0 DiceBear styles + Humaaans). If you ship a CC BY set you
  MUST credit — see [`ATTRIBUTION.md`](ATTRIBUTION.md). unDraw needs no credit but has its own limits.
- **Self-host, always.** No third-party CDN at runtime (GDPR). These files are already local; keep it
  that way — never swap them for a live DiceBear/unDraw/hosted URL.
- **Counts are exact:** every DiceBear style folder is 48 SVGs; the number in parentheses is per-style.
- Per-DiceBear-style truth lives in each `dicebear/<style>/meta.json` and the aggregate
  [`dicebear/manifest.json`](dicebear/manifest.json). The DiceBear rows below are generated from that
  manifest — do not hand-edit license/creator here; fix the source and regenerate. unDraw and
  Open Doodles carry their own `LICENSE.md` + `README.md` (don't duplicate them — summarized below).

---

## A. unDraw — 1362 editorial scenes (lead with this)

`undraw/svg/` — **unDraw** by **Katerina Limpitsouni** ([undraw.co](https://undraw.co)). The big,
"real scene" editorial set: heroes, empty states, feature blocks, onboarding vignettes — full
illustrations of people, objects and situations, not avatars. This is the most useful set here for
actual page art. 1362 SVGs, fully offline.

**License — NOT MIT.** Community mirror repos ship a `LICENSE` file that *claims* MIT; that label has
no authority over unDraw's copyright. The governing terms are **unDraw's own license** (see
[`undraw/LICENSE.md`](undraw/LICENSE.md)):

- ✅ Free for personal **and commercial** use; **no attribution required** (credit optional).
- ✅ Modify/recolor freely; ship inside the sites/products you deliver — the normal, permitted use.
- ❌ **No repackaging** as a competing pack/library (don't re-publish `undraw/` as an npm package,
  GitHub asset pack, or downloadable bundle — keep it an internal shelf of this kit).
- ❌ **No AI/ML training** on the assets (static graphics in a site = fine; feeding them to model
  training = not).

**How to theme — one accent color, one CSS variable.** Each unDraw SVG has a single accent color,
rewritten here from the original `#6c63ff` to the CSS custom property `--primary-svg-color`. Theme the
whole set with one rule:

```css
:root { --primary-svg-color: #ff5a1f; } /* your brand accent — applies to every inlined unDraw SVG */
```

The variable **only resolves when the SVG is inlined into the DOM** (imported as a React component, or
`?raw` + `dangerouslySetInnerHTML`). Referenced via `<img src>` / `background-image`, the external file
can't read the page's CSS variable — inline it, or bake a default fill into the file. Don't blanket-
replace every hex: the greys, skin tones and secondary blues are intentional. Full notes:
[`undraw/README.md`](undraw/README.md).

---

## B. DiceBear — 1488 avatars/doodles (31 styles × 48), grouped by license tier

Generated locally with deterministic seeds → identical output on every run. Grouped **by license
tier, not by look**, because the tier decides your shipping obligation. Each row: title / creator /
license / (per-style count = 48) / vibe.

### CC0 1.0 — public domain, no attribution, no conditions

- **Glass** — DiceBear — CC0 1.0 — (48) — abstract frosted-glass gradient blobs.
- **Identicon** — DiceBear — CC0 1.0 — (48) — symmetric geometric identicons (GitHub-style hashes).
- **Initials** — DiceBear — CC0 1.0 — (48) — lettermark tiles from initials, solid backgrounds.
- **Lorelei** — Lisa Wischofsky — CC0 1.0 — (48) — soft hand-drawn people avatars, fine line work.
- **Lorelei Neutral** — Lisa Wischofsky — CC0 1.0 — (48) — the Lorelei face only, no hair/shoulders.
- **Notionists** — Zoish — CC0 1.0 — (48) — Notion-style monochrome doodle people.
- **Notionists Neutral** — Zoish — CC0 1.0 — (48) — Notionists head-only, neutral crop.
- **Open Peeps** — Pablo Stanley — CC0 1.0 — (48) — hand-drawn editorial people (the Blush "peeps" look).
- **Pixel Art** — DiceBear — CC0 1.0 — (48) — 8-bit pixel character avatars.
- **Pixel Art Neutral** — DiceBear — CC0 1.0 — (48) — pixel avatars, neutral head crop.
- **Rings** — DiceBear — CC0 1.0 — (48) — concentric abstract ring marks.
- **Shapes** — DiceBear — CC0 1.0 — (48) — abstract geometric shape compositions.
- **Thumbs** — DiceBear — CC0 1.0 — (48) — playful abstract thumb/placeholder marks.

### MIT — no attribution required in the rendered product

- **Bootstrap Icons** (`icons`) — The Bootstrap Authors — MIT — (48) — clean UI glyphs on tinted tiles.

### Free for personal and commercial use — no attribution

- **Avataaars** — Pablo Stanley — Free P+C — (48) — the classic Sketch cartoon-people avatars.
- **Avataaars Neutral** — Pablo Stanley — Free P+C — (48) — Avataaars face only, neutral crop.
- **Bottts** — Pablo Stanley — Free P+C — (48) — friendly robot avatars.
- **Bottts Neutral** — Pablo Stanley — Free P+C — (48) — Bottts head only, neutral crop.

### CC BY 4.0 — attribution REQUIRED

Free to ship, **but every one of these obliges a credit line** if it appears in a shipped site. Copy
the matching block from [`ATTRIBUTION.md`](ATTRIBUTION.md). Don't want a credit line? Prefer a
no-attribution set above.

- **Adventurer** — Lisa Wischofsky — CC BY 4.0 — (48) — colorful stylized people avatars.
- **Adventurer Neutral** — Lisa Wischofsky — CC BY 4.0 — (48) — Adventurer face only, neutral crop.
- **Face Generator** (`big-ears`) — The Visual Team — CC BY 4.0 — (48) — big-eared cartoon people.
- **Face Generator** (`big-ears-neutral`) — The Visual Team — CC BY 4.0 — (48) — big-ears head, neutral.
- **Custom Avatar** (`big-smile`) — Ashley Seo — CC BY 4.0 — (48) — bright grinning cartoon people.
- **Croodles** — vijay verma — CC BY 4.0 — (48) — loose doodle-your-face people.
- **Croodles Neutral** — vijay verma — CC BY 4.0 — (48) — Croodles face only, neutral crop.
- **Dylan!** (`dylan`) — Natalia Spivak — CC BY 4.0 — (48) — chunky flat-color people avatars.
- **Fun Emoji Set** (`fun-emoji`) — Davis Uche — CC BY 4.0 — (48) — expressive emoji-style doodle faces.
- **Avatar Illustration System** (`micah`) — Micah Lanier — CC BY 4.0 — (48) — refined flat people avatars.
- **Miniavs** — Webpixels — CC BY 4.0 — (48) — minimal little-person avatars.
- **Personas** — Draftbit — CC BY 4.0 — (48) — clean flat character avatars.
- **ToonHead** (`toon-head`) — Johan Melin — CC BY 4.0 — (48) — expressive cartoon head illustrations.

**How to theme DiceBear:** these are deterministic — the file basename is the seed. Re-run
`scripts/gen-illustrations.mjs` (see below) with different seeds or `--count` to grow/refresh a style;
tweak colors/options at generation time, not by hand-editing files.

---

## C. Open Doodles — 33 CC0 scene doodles

`open-doodles/svg/` — **Open Doodles** by **Pablo Stanley** ([opendoodles.com](https://www.opendoodles.com)).
Loose, hand-drawn full-body people vignettes — the most Blush-like free *scene* set, a friendlier
counterpart to unDraw. **CC0 1.0** (public domain) — **no attribution, no conditions**. All
`viewBox="0 0 1024 768"`, self-contained. See [`open-doodles/README.md`](open-doodles/README.md).

**How to theme:** two-color palette baked in — ink `#000000` + accent `#FF5678`. Recolor by
find/replacing those two hex values in a file (no CSS variable; edit the file or preprocess).

The 33 doodles:

`ballet-doodle`, `bikini-doodle`, `chilling-doodle`, `clumsy-doodle`, `coffee-doodle`,
`dancing-doodle`, `dog-jump-doodle`, `doggie-doodle`, `float-doodle`, `groovy-doodle`,
`ice-cream-doodle`, `jumping-doodle`, `laying-doodle`, `levitate-doodle`, `loving-doodle`,
`meditating-doodle`, `moshing-doodle`, `petting-doodle`, `plant-doodle`, `reading-doodle`,
`reading-side-doodle`, `roller-skating-doodle`, `rolling-doodle`, `running-doodle`, `selfie-doodle`,
`sitting-doodle`, `sitting-reading-doodle`, `sleek-doodle`, `sprinting-doodle`, `strolling-doodle`,
`swinging-doodle`, `unboxing-doodle`, `zombieing-doodle`.

---

## D. Humaaans — mix-and-match people (CC BY 4.0, attribution REQUIRED)

`humaaans/` — **Humaaans** by **Pablo Stanley**, CC BY 4.0. The editorial mix-and-match people system
that Blush was built to sell: pose a body, swap a head, change the outfit. Provided here as SVG (79) +
PNG (158, `@1x`/`@2x`), not generated — mirrored from the open pack.

Structure:

- `humaaans/Humaaans/` — **ready-made full-body compositions** (`sitting-*`, `standing-*`), the fastest
  drop-in: a whole person per file.
- `humaaans/Single Pieces/` — **the mix-and-match parts** to assemble your own:
  - `Body/` — torsos/outfits (Hoodie, Jacket, Lab Coat, …).
  - `Head/Front/` — front-facing heads.
  - `Bottom/Sitting/`, `Bottom/Standing/` — legs/pose bases.
  - `Objects/Seat/` — props to sit on.
  - `Scene/` — backdrops (Home, Plants, Whiteboard, Wireframe).

Ships → must credit. See [`ATTRIBUTION.md`](ATTRIBUTION.md).

---

## How to use

Flat 2D SVG — so use it wherever a picture goes:

- **DOM / overlay layer** — hero and section art, decorative spot illustrations, `<img>`/inline SVG.
  This layer lives *above* the R3F `<Canvas>`; it does not touch the WebGPU/TSL renderer. Reach for
  **unDraw** for real editorial scenes, **Open Doodles / Humaaans** for friendly people, **DiceBear**
  for avatars and abstract marks.
- **Empty / error / onboarding states** — the canonical job: "no results yet", 404/500, first-run
  walkthroughs. unDraw feature scenes and Open Doodles / Humaaans / Open Peeps read friendly here.
- **Textured onto the 3D layer** — map an SVG onto an R3F plane when you want illustration *inside* the
  scene: drei `<Image>`, or rasterize the SVG to a `CanvasTexture`/`THREE.Texture` and apply it as a
  map. Keep it 2D-flat facing camera unless you deliberately want it to distort with the geometry.
  Note: `--primary-svg-color` (unDraw) only resolves for **inlined DOM** SVG, not for a rasterized
  texture — bake the accent into the file before rasterizing.

Kit rules still apply to whichever layer you place it in: `prefers-reduced-motion` is a **canvas**
concern, not one of these static assets — the SVGs themselves don't animate, so honor reduced-motion
only on any animation *you* add around them. Keep text contrast ≥4.5:1 over busy backgrounds, and
don't spin a second RAF/scroll loop — reuse the host's Lenis + GSAP ticker.

## Regenerate / expand

Re-generate the DiceBear set (deterministic seeds → identical output) or add variants:

```bash
node scripts/gen-illustrations.mjs                 # all 31 styles, 48 variants each
node scripts/gen-illustrations.mjs --count 96      # more variants per style
node scripts/gen-illustrations.mjs openPeeps lorelei --count 60   # specific styles
```

Each run rewrites `dicebear/<style>/` + its `meta.json` and the aggregate `dicebear/manifest.json`
(the real license + creator, read from DiceBear's style metadata).

unDraw, Open Doodles and Humaaans are **static mirrors**, not produced by the script. To re-vendor:

```bash
# unDraw (see undraw/README.md for full notes + the CSS-var accent rewrite)
git clone --depth 1 https://github.com/balazser/undraw-svg-collection.git /tmp/undraw-src
cp /tmp/undraw-src/svgs/*.svg lib/illustrations/undraw/svg/   # keep OUR undraw/LICENSE.md, not the mirror's

# Open Doodles (generated from the React component source; see open-doodles/README.md)
git clone --depth 1 https://github.com/lunahq/react-open-doodles.git
# extract each <svg>…</svg>, replace ={ink}→"#000000" and ={accent}→"#FF5678", convert JSX attrs to SVG.
```

Humaaans is a plain static mirror of the open pack — leave it as-is.
