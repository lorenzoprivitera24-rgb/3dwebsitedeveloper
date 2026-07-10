# 05 · pinned-scene-scrub

Il mattone-firma del genere (sezione 3 di ORYZO): pin di 250vh (180 su mobile via
`gsap.matchMedia`), scrub cucito al pixel, `progressMap.scrub` consumato dal CameraDirector che
apre il morph 0.35→1 e orbita la camera. I 3 caption si avvicendano a soglie [0, 0.4, 0.75] via
classList (zero re-render React). `invalidateOnRefresh` + `anticipatePin` inclusi; il pin-spacer
è gestito da ScrollTrigger (niente CLS: la sezione è alta 100vh, la durata è virtuale).
Reduced-motion: nessun pin, colonna statica con tutti gli step, scena ferma (director).

Uso: `<PinnedSceneScrub copy={scrubJson} reduced={reduced} />` con `content/05-scrub.json`.
