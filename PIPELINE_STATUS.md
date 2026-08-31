# PIPELINE_STATUS — dove siamo nella pipeline

> **Prima cosa che ogni sessione legge.** Aggiornarlo a ogni passaggio di stadio fa parte del
> "done" dello stadio. Le regole e i comandi della fabbrica sono in `CLAUDE.md` § The factory.

- **Progetto**: demo starter interno («Form in Motion»)
- **Stadio corrente**: **S6/S7 sulla demo interna** — 14 sezioni, **registro numerato COMPLETO
  15/15** (S2 storyboard ✓, S3 content ✓, S5 composizione ✓); nessun brief CLIENTE attivo
- **Ultimo aggiornamento**: 2026-08-31 (merge train: velocity + gates + product-choreography
  unificati su main — Vite 8, tre gate qa, famiglia prodotto rinumerata 13·14·15)

| Stadio | Owner | Artefatto | Stato | Gate |
|---|---|---|---|---|
| S0 intake | skill `client-intake` | `brief/brief.md` | — | **umano** (cliente) |
| S1 direzione | `creative-director` | `brief/direction.md` + blocco tokens | — | **umano** |
| S2 storyboard | `scroll-storyboarder` | `brief/storyboard.md` | — | **umano** |
| S3 copy | `copy-chief` | `content/*.json` | — | checklist slot |
| S4 asset | `asset-wrangler` | `public/assets/*` + `assets-manifest.json` | — | budget `encode-assets` |
| S5 composizione | `blueprint-librarian` + specialisti | sezioni da `/registry` + custom | — | regola d'oro registro |
| S6 QA visiva | `visual-qa-operator` | `qa/issues.md` (max 3 giri) | — | zero issue «blocca» |
| S7 perf gate | `perf-fallback-auditor` | `qa/perf-report.md` | — | report verde → deploy |

Regole di passaggio: nessuno stadio parte se manca l'artefatto dello stadio precedente; i gate
umani si superano solo con OK esplicito; ogni artefatto chiude con la sua checklist spuntata.

**Debito JS iniziale: CHIUSO.** Era 604,8 KB gzip e il gate non poteva vederlo scendere, perché
sommava tutti i chunk e chiamava «iniziale» il totale. Ora `perf:check` cammina il **manifest di
Vite** dagli entry lungo i soli import statici (versione recuperata dal worktree `perf`, budget
150 target / 300 cap + guardia sul totale >700): **161,5 KB gzip iniziali** sulla demo unificata
a 12 sezioni (🟡 11,5 sopra il target; 431 differiti, 592,5 totali). Il salto viene
dall'inversione della dipendenza sul progresso di caricamento: `src/lib/loadProgress.ts`.

**Registro COMPLETO 15/15** (08 spec-sheet-latex e 10 display-statement chiusi il 31 ago: KaTeX
da import dinamico — l'entry non lo paga, +1,4 KB di componenti). Gate al 31 ago 2026:
`qa:state` 🟢 16/16 checkpoint sulla drammaturgia unificata · `qa:diff` 🟢 42/42 ·
`qa:reduced` 🟢 0 errori · `qa:verify` 🟢 WebGPU 0 errori console · `qa:frames` **bloccato
dall'ambiente su questo Mac**: mediana inchiodata a 33,3 ms su OGNI path e sezione, invariante
al throttle CPU 4× → tetto vsync/compositor a 30 Hz dello schermo, non carico dell'app (misura
del 31 ago; macchinario del gate operativo). Serve un giro su display a 60 Hz o device reale.

**Layer adattivo runtime: CHIUSO** (31 ago 2026, ROADMAP «Adaptive layer»):
`src/canvas/AdaptiveQuality.tsx` — PerformanceMonitor → setDpr dentro il range del tier
(un solo owner del dpr), AdaptiveEvents nel regress, flipflops=3 → resa al floor, spento con
`?qa=1` per il determinismo dei gate. + `src/hooks/useRenderBackend.ts` (la cucitura
backend.isWebGPUBackend per i feature-gate compute/post).

**Debiti aperti**: TypeScript fermo alla 6 finché typescript-eslint non supporta la 7 (motivo in
`package.json` → `//versions`); `qa/baseline/` va rigenerata a ogni cambio voluto dell'aspetto
(`npm run qa:bless`) — e il merge train ha cambiato la pagina: baseline da ribenedire.

**Branch aperti**: `feat/product-choreography` (worktree `.claude/worktrees/product-choreo`,
6 ago) — famiglia «prodotto a strati» completa e verificata in browser reale. **NON mergiato.**

`gen-factory-lug10` (worktree `.claude/worktrees/gen-factory`, 10 lug) —
blueprint **04-pointer-rig-3d implementato** + layer «generative factory» (4 agenti nuovi,
2 skill, intake a 3 porte S0a/b/c, backlog 13-18, master plan). **NON mergiato**: serve review
+ OK umano esplicito prima del merge.
