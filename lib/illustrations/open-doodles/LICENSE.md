# Open Doodles — License

**Artwork: CC0 1.0 Universal (Public Domain Dedication).**

Open Doodles is a free set of sketchy scene illustrations by Pablo Stanley
(<https://www.opendoodles.com>). The illustrations are released under CC0:

> You can copy, edit, remix, share, or redraw these images for any purpose
> without restriction under copyright or database law (CC0 license).
> Free for Commercial and Personal Use. No need to credit, license, or anything.

CC0 full text: <https://creativecommons.org/publicdomain/zero/1.0/>

**No attribution is required.** These files can be shipped with zero credit.

## Provenance of the SVG files in this folder

The SVGs here were generated from the official Open Doodles source code, which
stores each doodle as an inline-SVG React component (colors parameterized as
`ink` / `accent`). We extracted the `<svg>` markup from each component and baked
in the default palette:

- `ink`   → `#000000`
- `accent`→ `#FF5678`

Source of the components: `lunahq/react-open-doodles`
(<https://github.com/lunahq/react-open-doodles>), a React wrapper of Open Doodles.
That wrapper's *code* is MIT-licensed (Copyright (c) 2020 Luna); the underlying
Open Doodles *artwork* is CC0 as stated above. Neither license requires
attribution for redistribution of the illustrations.

The same 33 doodles also live in the official website source
`fangpenlin/open-doodles` (<https://github.com/fangpenlin/open-doodles>), which
powers opendoodles.com and additionally contains `GroovySittingDoodle` and
`MessyDoodle`.
