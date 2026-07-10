# 06 · kinetic-type

Il display statement del genere, fatto col SplitText della nuova era (gratuito, 3.13+): `mask:
'lines'` integrato, `autoSplit` che ri-splitta a resize/font-load ricostruendo l'animazione in
`onSplit` (regola della skill awwwards-motion-patterns). Il titolo parte `visibility:hidden` in
CSS e diventa visibile solo a split avvenuto (anti-FOUC). Entrata toggle `play none none
reverse` — il testo ENTRA, non si scrubba. Scrive `progressMap.kinetic`: il CameraDirector calma
la scena (morph→0.15, camera arretra) perché qui il protagonista è il testo.

Uso: `<KineticType copy={kineticJson} reduced={reduced} />` con `content/06-kinetic.json`.
