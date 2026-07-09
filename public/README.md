# public/ — self-hosted runtime assets

Rule: **nothing loads from a third-party CDN at runtime** (GDPR + reliability). Everything the
renderer needs at runtime lives here and ships with the site.

- `basis/` — KTX2/Basis Universal transcoder (Apache-2.0), copied from
  `node_modules/three/examples/jsm/libs/basis/`. Consumed via
  `KTX2Loader.setTranscoderPath('/basis/')` — see `src/lib/ktx2.ts`.
- `draco/` — Draco mesh decoder (Apache-2.0), copied from
  `node_modules/three/examples/jsm/libs/draco/gltf/`. Consumed via
  `DRACOLoader.setDecoderPath('/draco/')`.
- `hdri/` — IBL environment maps. `studio_small_08_1k.hdr` is Poly Haven, **CC0**.
  1k is enough when the HDRI only lights the scene (PMREM prefilters it anyway); use 2k
  only if the HDRI is visible as a background. Studio alternative with zero photo weight:
  `<Environment resolution={256}>` + a `<Lightformer>` rig.

Maintenance: after a `three` major bump, re-copy both transcoder folders (the encode pipeline
in `scripts/encode-assets.mjs` states the source paths in its header).
