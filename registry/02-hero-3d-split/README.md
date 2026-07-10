# 02 · hero-3d-split

Hero del genere: copy editoriale (eyebrow mono + display + sub + CTA pill) sopra la scena
persistente; la "metà 3D" non è un canvas separato ma la posa camera del capitolo `hero` nel
CameraDirector. Il testo entra one-shot (Motion), l'uscita è scrubbata (GSAP). Scrive
`progressMap.hero`. Su mobile lo split diventa stack centrato via CSS (`.bp-hero__copy`).
L'eyebrow usa `var(--mono)` e il blocco copy ha uno scrim locale: risolve by-design i due issue
QA del giro precedente (contrasto + mono).

Uso: `<Hero3dSplit copy={heroJson} reduced={reduced} />` con `content/01-hero.json`.
Nota demo: l'oggetto hero è la MorphingForm; per un GLB prodotto si aggiunge il modello alla
scena e si punta la posa camera del capitolo — il contratto non cambia.
