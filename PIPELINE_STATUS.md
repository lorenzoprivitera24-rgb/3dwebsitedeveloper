# PIPELINE_STATUS — dove siamo nella pipeline

> **Prima cosa che ogni sessione legge.** Aggiornarlo a ogni passaggio di stadio fa parte del
> "done" dello stadio. Le regole e i comandi della fabbrica sono in `CLAUDE.md` § The factory.

- **Progetto**: demo starter interno («Form in Motion»)
- **Stadio corrente**: **S6/S7 sulla demo interna** — 5 blueprint composti (S2 storyboard ✓,
  S3 content ✓, S5 composizione ✓ da `brief/composition-plan.md`); nessun brief CLIENTE attivo
- **Ultimo aggiornamento**: 2026-07-10 (branch `w34-blueprints`)

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

**Debiti noti**: bundle demo ~416 KB gzip (app) vs target 300 — si affronta con code-split /
starter Next, tracciato in `docs/gap-analysis-2026-07-09.md`; registro a 0/12 blueprint
(Settimana 3).
