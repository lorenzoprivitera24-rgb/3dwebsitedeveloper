# 01 · preloader-progress

Preloader col progresso VERO (drei `useProgress` → DefaultLoadingManager: HDRI/GLB/KTX2), non una
barra finta. Blocca Lenis finché il sipario è giù, `minShowMs` evita il flash su cache calda, un
failsafe da 4s garantisce che non sequestri mai la pagina. Reduced-motion: niente slide, uscita
immediata (le transizioni CSS sono già azzerate dal global).

Uso: `<PreloaderProgress minShowMs={600} reduced={reduced} />` come primo figlio di
`<SmoothScroll>`. Stili: `.bp-preloader` in styles.css.
