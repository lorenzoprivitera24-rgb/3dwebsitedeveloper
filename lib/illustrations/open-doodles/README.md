# Open Doodles

Free, hand-drawn scene illustrations of people by **Pablo Stanley**
(<https://www.opendoodles.com>). Public domain (**CC0**) — no attribution required.

- **33 SVGs** in [`svg/`](svg), all `viewBox="0 0 1024 768"`, self-contained (no
  external refs, no fonts, no runtime CDN).
- Palette baked in: ink `#000000`, accent `#FF5678`. To recolor, find/replace
  those two hex values in a file.

## Files

| # | name | # | name |
|---|------|---|------|
| 1 | `ballet-doodle` | 18 | `petting-doodle` |
| 2 | `bikini-doodle` | 19 | `plant-doodle` |
| 3 | `chilling-doodle` | 20 | `reading-doodle` |
| 4 | `clumsy-doodle` | 21 | `reading-side-doodle` |
| 5 | `coffee-doodle` | 22 | `roller-skating-doodle` |
| 6 | `dancing-doodle` | 23 | `rolling-doodle` |
| 7 | `dog-jump-doodle` | 24 | `running-doodle` |
| 8 | `doggie-doodle` | 25 | `selfie-doodle` |
| 9 | `float-doodle` | 26 | `sitting-doodle` |
| 10 | `groovy-doodle` | 27 | `sitting-reading-doodle` |
| 11 | `ice-cream-doodle` | 28 | `sleek-doodle` |
| 12 | `jumping-doodle` | 29 | `sprinting-doodle` |
| 13 | `laying-doodle` | 30 | `strolling-doodle` |
| 14 | `levitate-doodle` | 31 | `swinging-doodle` |
| 15 | `loving-doodle` | 32 | `unboxing-doodle` |
| 16 | `meditating-doodle` | 33 | `zombieing-doodle` |
| 17 | `moshing-doodle` |  |  |

## License

CC0 1.0 — see [`LICENSE.md`](LICENSE.md). Free for commercial and personal use,
no credit needed.

## How these were vendored

The S3 direct URLs (`opendoodles.s3-us-west-1.amazonaws.com/<Name>.svg`) return
**403** and opendoodles.com serves no inline asset URLs, so there is no
scriptable download of finished `.svg` files from the site itself. The official
"Download" button just links to a Dropbox folder
(`https://www.dropbox.com/sh/egmjlot3o8787sr/AABbIT7a1-3zWvF7HQ8R21_ta?dl=0`),
which is not scriptable headlessly.

Instead, the SVGs were generated from the open-source component code where each
doodle is stored as an inline-SVG React component. See `LICENSE.md` for exact
provenance. To regenerate:

```sh
git clone --depth 1 https://github.com/lunahq/react-open-doodles.git
# for each src/components/*.tsx: extract the <svg>...</svg> block,
# replace ={ink} -> "#000000" and ={accent} -> "#FF5678",
# convert JSX attrs (fillRule->fill-rule, strokeWidth->stroke-width, ...) to SVG.
```
