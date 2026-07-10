# Composition plan — demo starter (S5)

Data: 2026-07-10 · Input: storyboard.md + registry/*/meta.json · Owner: blueprint-librarian

| # | Sezione | Blueprint | Props (fonte) | Copy | Dipendenze scena condivise |
|---|---|---|---|---|---|
| 0 | preloader | `01-preloader-progress` | minShowMs=600 | — | drei useProgress (loader globale) |
| 1 | #hero | `02-hero-3d-split` | copy, reduced | 01-hero.json | scrive progress `hero` |
| 2 | #gradient | `03-mesh-gradient-field` | copy, reduced | 03-gradient.json | scrive `gradient`; consuma GradientBackdrop (uniform da TOKENS.gradient) |
| 3 | #scrub | `05-pinned-scene-scrub` | copy, reduced, pinVh(250/180 mobile) | 05-scrub.json | scrive `scrub` (pin) |
| 4 | #kinetic | `06-kinetic-type` | copy, reduced | 06-kinetic.json | scrive `kinetic` |
| 5 | #outro | CUSTOM inline (footer editoriale) | — | 07-outro.json | nessuna |

**Ordine di implementazione**: core scena (progressMap → sceneTargets → CameraDirector →
GradientBackdrop → MorphingForm adattato) → blueprint 01 → 02 → 03 → 05 → 06 → ricomposizione
App → QA loop.

**Ownership**: i blueprint DOM scrivono SOLO `progressMap[<id>]` (via `useSectionProgress`);
`CameraDirector` è l'unico scrittore di camera e `sceneTargets`; ogni materiale dampa i propri
uniform dai target (un solo scrittore per valore a ogni livello).

**CUSTOM da promuovere a fine giro**: nessuno (l'outro è footer semplice; il candidato `12
footer-cta` resta pianificato).
