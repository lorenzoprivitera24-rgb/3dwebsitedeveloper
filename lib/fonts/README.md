# Fonts — self-hosted type shelf (GDPR-safe)

30 curated Google Fonts vendored **locally** so the visitor's browser never contacts a Google
server. Full catalog + pairing/use notes: [`FONTS.md`](FONTS.md).
See [`../../STACK.md`](../../STACK.md) for how this fits the stack.

## What / why

Loading fonts from `fonts.googleapis.com` at **runtime** leaks the visitor's IP to Google without
consent — held a GDPR breach in the Munich ruling **3 O 17493/20**. So every family here is fetched
at build time and served from our own origin: **no runtime CDN, no `fonts.googleapis.com` links or
`@import`.** All 30 families are **OFL-1.1**, and the license travels with the fonts.

## Structure

Each family is a self-contained folder (space-stripped name, e.g. `SpaceGrotesk/`):

```
<Family>/
  files/*.woff2     # one file per weight (latin + latin-ext, normal)
  font.css          # generated @font-face rules → ./files/*.woff2, font-display: swap
  LICENSE.txt       # the family's OFL license (auto-copied on fetch)
  meta.json         # id, family, role, category, version, weights[], license, …
```

`meta.json` `role` groups the shelf into **Sans / Display / Serif / Mono** (see `FONTS.md`).

## Two ways to consume

1. **Local `font.css` (this shelf).** Import the family's `font.css` and set `font-family` to the
   exact family name. The `@font-face` rules are already generated; nothing to build. Best when you
   want to drop a folder into any project, build step or not.

   ```ts
   import '../lib/fonts/SpaceGrotesk/font.css';
   /* h1 { font-family: 'Space Grotesk', system-ui, sans-serif; } */
   ```

   Preload the 1–2 hero weights you paint above the fold; every face ships `font-display: swap`.

2. **`@fontsource` npm (Vite-bundled variable fonts).** For an app that already bundles, pull the
   variable font via [`@fontsource-variable/<family>`](https://fontsource.org) — one file across the
   whole weight axis, tree-shaken and fingerprinted by Vite, still self-hosted (no CDN).

## Add a font (on-demand fetcher)

[`scripts/add-font.mjs`](../../scripts/add-font.mjs) pulls **any** of ~1,900 Google families and
vendors it in the same shape (woff2 + `font.css` + license + `meta.json`). Ids are the kebab-case
slug from `fonts.google.com`.

```bash
node scripts/add-font.mjs space-grotesk                       # add a family
node scripts/add-font.mjs lexend --weights 300,regular,600,900
node scripts/add-font.mjs inter --subsets latin,latin-ext,cyrillic --italics
node scripts/add-font.mjs                                      # rebuild the curated shortlist
```

The OFL/Apache license file is fetched and copied into the family folder automatically — the
license always ships with the fonts.
