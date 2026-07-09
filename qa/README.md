# qa/ — il loop che guarda il sito davvero

Build verde ≠ prova. Il ciclo (max **3 giri**, poi il problema sale a Lorenzo):

1. `npm run qa:shoot` — scrolla il sito sezione per sezione a 390/834/1440, salva screenshot in
   `qa/shots/` + `qa/shots/report.json` (errori console inclusi). Richiede il dev server attivo
   (`npm run dev -- --port 5199 --strictPort --host 127.0.0.1`, FUORI sandbox se serve al browser).
2. Il `visual-qa-operator` GUARDA ogni screenshot contro `brief/storyboard.md` e `direction.md`
   e scrive `qa/issues.md`: una voce per problema con `screenshot · sezione · gravità
   (blocca/alta/bassa) · fix proposto`. Non corregge il codice: riporta.
3. L'orchestratore smista i fix agli specialisti → nuovo shoot.

Verifica rapida single-shot (backend reale + errori console): `npm run qa:verify`.
Gate finale: `npm run perf:check` → `qa/perf-report.md` (budget in `scripts/perf-check.mjs`).

Gotcha macchina (lug 2026): il Chrome dell'utente non raggiunge i server locali → la verifica
passa SEMPRE da playwright-core + Chrome for Testing in cache (`scripts/verify-preview.mjs`),
mai dall'estensione Chrome. `qa/shots/` è ignorata da git (artefatti riproducibili).
