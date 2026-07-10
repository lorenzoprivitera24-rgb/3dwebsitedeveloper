# Storyboard — demo starter «Form in Motion» (composta dal registro)

Data: 2026-07-10 · Input: `brief.md` (demo interna) + `direction.md` + `registry/INDEX.md` · Owner: scroll-storyboarder
La scena WebGL è UNA e persistente (forma morfica + backdrop gradient). 5 sezioni + outro.

---

## S1 — hero (`#hero`)
- **Blueprint**: `02-hero-3d-split`
- **Scena 3D (A→B)**: camera z 6→4.5, y 0→0.4; morph 0.15→0.35 (la forma "si sveglia" mentre l'hero scorre via)
- **Trigger e durata**: sezione 140vh, inner sticky; progress `hero` = attraversamento sezione; no pin ST, no scrub DOM (entrate one-shot, fade-out scrubbato)
- **Slot copy**: eyebrow · headline · sub · cta → `content/01-hero.json`
- **Mobile**: layout centrato (il split diventa stack), stessi slot
- **Reduced-motion**: entrate = solo opacity; niente fade-out scrubbato; scena in stato calmo fisso

## S2 — gradient (`#gradient`)
- **Blueprint**: `03-mesh-gradient-field`
- **Scena 3D (A→B)**: backdrop gradient `uMix` 0→1→0 (sin(π·p)): il campo entra, satura dietro la forma, esce; camera deriva x +0.3; morph resta 0.35
- **Trigger e durata**: 170vh, progress `gradient` = top bottom → bottom top, scrub
- **Slot copy**: eyebrow · headline · sub → `content/03-gradient.json`
- **Mobile**: uguale; `flow` dimezzato su tier low
- **Reduced-motion**: uMix fisso 0.5 dentro la sezione (crossfade lento via damp), flow 0

## S3 — scrub (`#scrub`)
- **Blueprint**: `05-pinned-scene-scrub`
- **Scena 3D (A→B)**: PIN. morph 0.35→1.0 (apertura massima + emissive), camera orbita (x = sin(p·π·0.9)·1.2, z 4.5→3.2, y +sin(p·π)·0.8)
- **Trigger e durata**: pin `+=250%` (250vh), scrub; progress `scrub` = self.progress del pin; 3 step di caption DOM che si avvicendano a p≈0/0.4/0.75
- **Slot copy**: eyebrow · steps[3] → `content/05-scrub.json`
- **Mobile**: pin ridotto a `+=180%`; caption invariati
- **Reduced-motion**: NIENTE pin — sezione 100vh statica con i 3 step visibili in colonna; scena ferma a morph 0.35

## S4 — kinetic (`#kinetic`)
- **Blueprint**: `06-kinetic-type`
- **Scena 3D (A→B)**: la scena si calma: morph →0.15, camera arretra z→6.5, gradient spento — il TESTO è il protagonista
- **Trigger e durata**: 130vh; righe display rivelate a maschera all'ingresso (toggle `play none none reverse`), stagger 0.08/riga; progress `kinetic` per la scena
- **Slot copy**: eyebrow · lines[3] → `content/06-kinetic.json`
- **Mobile**: clamp tipografico già fluido; nessun cambio
- **Reduced-motion**: righe visibili, solo fade

## S5 — outro (`#outro`)
- **Blueprint**: CUSTOM minimale (non da registro: è il footer editoriale del demo)
- **Scena 3D**: stato B di S4 mantenuto (calma)
- **Slot copy**: headline · body · footnote → `content/07-outro.json`
- **Mobile/Reduced**: statico per natura

---

## Transizioni tra sezioni (testimone)
- hero→gradient: morph resta 0.35 (stato B di S1 = stato A di S2); entra solo il backdrop
- gradient→scrub: uMix scende con l'uscita della sezione; il pin prende il testimone del morph a 0.35
- scrub→kinetic: morph scende 1→0.15 e camera arretra guidati da `kinetic` (S3 finita = s=1, mix(1, 0.15, k))
- Owner: OGNI canale scena (camera, morph, gradientMix) è scritto SOLO dal CameraDirector; i materiali dampano verso i suoi target.

## Checklist completezza
- [x] Ogni sezione ha blueprint del registro o CUSTOM con specifica
- [x] Un solo owner per canale (CameraDirector; i blueprint scrivono solo il proprio progress)
- [x] Slot copy = esattamente i content/*.json elencati
- [x] Mobile e reduced-motion definiti per OGNI sezione
- [x] Durate totali ≈ 140+170+100(+250% pin)+130+100vh ≈ 10.9 viewport — dentro il limite
