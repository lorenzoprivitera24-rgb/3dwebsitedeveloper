# Fonts — self-hosted, GDPR-safe type shelf

30 curated Google Fonts vendored **locally** as `woff2` + a self-contained `@font-face`
`font.css` + the family's OFL license + `meta.json`. Sites import the local CSS; the visitor's
browser **never** contacts a Google server. See [`../../STACK.md`](../../STACK.md) for how this
fits the stack.

Every family here is **OFL-1.1**. The license travels with the fonts (`LICENSE.txt` in each
folder is auto-copied on fetch) — keep it when you ship a family into a project.

> **Why self-host (hard rule).** The Munich regional court ruling **3 O 17493/20** held that
> loading fonts from `fonts.googleapis.com` at runtime leaks the visitor's IP to Google without
> consent — a GDPR breach. So: **never emit `fonts.googleapis.com` links or `@import`, and never
> use a runtime CDN.** Everything is vendored and served from the same origin.

## The shelf, by role

Every family is `latin` + `latin-ext`, normal (upright) only, `OFL-1.1`. "Weights" is the count
of vendored `woff2` files (300–800 where the family offers them; single-weight display/mono faces
ship one).

### Sans — body & UI

| Family | Weights | License | Vibe / use |
|---|---|---|---|
| Inter | 6 | OFL-1.1 | The safe default; neutral UI/body workhorse at any size. |
| Geist | 6 | OFL-1.1 | Vercel's clean geometric sans; crisp product-UI feel. |
| Manrope | 6 | OFL-1.1 | Rounded-modern sans; friendly SaaS body + headings. |
| Plus Jakarta Sans | 6 | OFL-1.1 | Slightly quirky geometric; distinctive but readable UI. |
| Outfit | 6 | OFL-1.1 | Even, geometric, cool; great for minimal marketing sites. |
| DM Sans | 6 | OFL-1.1 | Low-contrast geometric; tidy small-text and captions. |
| Figtree | 6 | OFL-1.1 | Warm humanist sans; approachable body copy. |
| Albert Sans | 6 | OFL-1.1 | Geometric grotesque with character; confident headings. |
| Hanken Grotesk | 6 | OFL-1.1 | Neutral grotesque; solid all-rounder for text + UI. |
| Onest | 6 | OFL-1.1 | Contemporary neutral sans; clean dashboards and text. |
| Sora | 6 | OFL-1.1 | Techy geometric with squared terminals; futuristic body/UI. |
| Space Grotesk | 5 | OFL-1.1 | Techy geometric display-sans; retro-futurist headlines + labels. |
| Instrument Sans | 4 | OFL-1.1 | Compact humanist grotesque; editorial UI and captions. |

### Display — headlines & hero type

| Family | Weights | License | Vibe / use |
|---|---|---|---|
| Unbounded | 6 | OFL-1.1 | Bold rounded oversized display; loud hero statements. |
| Bricolage Grotesque | 6 | OFL-1.1 | Quirky editorial grotesque; expressive posters and headlines. |
| Familjen Grotesk | 4 | OFL-1.1 | Idiosyncratic Swedish grotesque; stylish mid-weight headings. |
| Syne | 5 | OFL-1.1 | Arty extended display; gallery/creative-studio wordmarks. |
| Archivo | 6 | OFL-1.1 | Grotesque built for big & small; sturdy magazine headlines. |
| Anton | 1 | OFL-1.1 | Ultra-condensed heavy poster face; single-weight impact banners. |
| Fraunces | 6 | OFL-1.1 | Soft-serif editorial "old-style" display; warm literary headlines. |

### Serif — editorial & long-form

| Family | Weights | License | Vibe / use |
|---|---|---|---|
| Instrument Serif | 1 | OFL-1.1 | High-contrast display serif; elegant one-weight hero lines. |
| Newsreader | 6 | OFL-1.1 | Screen-tuned reading serif; long-form articles and blogs. |
| Spectral | 6 | OFL-1.1 | Refined text serif; balanced body copy with a print feel. |
| Lora | 4 | OFL-1.1 | Warm contemporary serif; comfortable running text. |
| Playfair Display | 5 | OFL-1.1 | High-contrast Didone; luxurious editorial and fashion headlines. |

### Mono — code, labels & data

| Family | Weights | License | Vibe / use |
|---|---|---|---|
| Geist Mono | 6 | OFL-1.1 | Clean modern mono; UI code blocks and numeric labels. |
| JetBrains Mono | 6 | OFL-1.1 | Coder-favorite mono with ligatures; terminals and snippets. |
| IBM Plex Mono | 5 | OFL-1.1 | Corporate-warm mono; technical text with personality. |
| Space Mono | 2 | OFL-1.1 | Retro-futurist quirky mono; captions, tags, brand accents. |
| Fragment Mono | 1 | OFL-1.1 | Understated single-weight mono; minimal meta text and code. |

## How to use

Each family folder is self-contained: `<Family>/files/*.woff2` + `<Family>/font.css`
(the `@font-face` rules are **already generated**) + `LICENSE.txt` + `meta.json`.

1. **Import the family's `font.css`** (once, from your entry CSS or a top-level import):

   ```css
   @import url('/lib/fonts/SpaceGrotesk/font.css');
   ```
   ```ts
   // or from a module entry, so Vite fingerprints and bundles the woff2:
   import '../lib/fonts/SpaceGrotesk/font.css';
   ```

2. **Set `font-family`** to the exact family name (spaces included, as written in the table):

   ```css
   :root { --font-display: 'Space Grotesk', system-ui, sans-serif; }
   h1 { font-family: var(--font-display); font-weight: 700; }
   ```

3. **Preload the 1–2 hero faces** you paint above the fold, so the headline doesn't wait on CSS:

   ```html
   <link rel="preload" as="font" type="font/woff2" crossorigin
         href="/lib/fonts/SpaceGrotesk/files/space-grotesk-v22-latin_latin-ext-700.woff2">
   ```

   Every face already ships `font-display: swap` (text renders immediately in a fallback, then
   swaps in) — preload only the couple of weights that matter for LCP, not the whole family.

> **Notes for agents**
> - Use the family name **verbatim** (`'Space Grotesk'`, `'Plus Jakarta Sans'`). The folder is
>   the space-stripped name (`SpaceGrotesk/`); the CSS `font-family` keeps the spaces.
> - Ship only the families a site actually uses — copy the folder into the project, don't `@import`
>   all 30. This is a reference shelf, not a runtime dependency.
> - Pair sensibly: one Display/Serif for headlines + one Sans for body + optional Mono for
>   labels/code. Two body sans on one page is usually a mistake.
> - Match the weights you load to the weights you use — every extra `woff2` is bytes on the wire.

## Add any other font

The shelf is a shortlist. The fetcher pulls **any** of ~1,900 Google families and vendors it in
the same GDPR-safe shape (woff2 + `font.css` + license + `meta.json`). Ids are the kebab-case
slug from `fonts.google.com` (e.g. `Space Grotesk` → `space-grotesk`).

```bash
# add specific families (gwfh ids)
node scripts/add-font.mjs lexend bespoke-serif

# choose weights / subsets / italics
node scripts/add-font.mjs lexend --weights 300,regular,600,900
node scripts/add-font.mjs inter --subsets latin,latin-ext,cyrillic --italics

# re-run with no args to (re)build the curated shortlist above
node scripts/add-font.mjs
```

The OFL/Apache license file is fetched and copied into the family folder automatically, so the
license always travels with the fonts.

> **Variable-font alternative (app builds).** For a Vite-bundled app you can instead pull the
> **variable** font via [`@fontsource-variable/<family>`](https://fontsource.org) from npm — one
> file spanning the whole weight axis, tree-shaken and fingerprinted by the bundler, still fully
> self-hosted (no CDN). Use this shelf's static `woff2` when you want a plain `font.css` you can
> drop into any project without a build step; use `@fontsource` when the project already bundles
> and you want variable-weight range from a single file.
