# registry/ — la libreria di sezioni componibili (la mossa Relume)

**Regola d'oro del kit: prima di scrivere una sezione da zero, consulta questo registro.**
L'agente compone il sito scegliendo e parametrizzando blueprint; il custom si scrive solo per ciò
che il registro non copre — e se supera il QA viene *promosso* a blueprint. Il registro è l'asset
aziendale che cresce progetto dopo progetto.

## Struttura di un blueprint

```
registry/<id>/
  meta.json          # contratto: trigger, props, slot, perfTier, mobileFallback, dipendenze
  <Componente>.tsx   # sezione React (+ eventuale modulo scena in webgl/)
  README.md          # come si usa, screenshot, note di costo
```

Schema `meta.json`:

```json
{
  "id": "pinned-scene-scrub",
  "descrizione": "Sezione pinnata: la scena 3D si trasforma mentre l'utente scrolla",
  "trigger": ["scroll to continue", "trasformazione", "morph", "pin"],
  "props": { "steps": "keyframe camera/materiali", "copy": "slot" },
  "slotCopy": ["eyebrow", "headline", "sub"],
  "perfTier": "C",
  "mobileFallback": "poster + timeline ridotta",
  "dipendenze": ["gsap/ScrollTrigger", "lenis"]
}
```

Regole: props parametriche dai token (mai colori hardcoded); fallback mobile e reduced-motion
OBBLIGATORI nel contratto; cleanup (trigger + dispose) parte del componente; un blueprint entra
solo dopo il QA visivo su una pagina reale. Crescita: il blueprint-librarian apre la scheda
«blueprint mancante» → lo specialista lo costruisce per il progetto corrente → a progetto chiuso
si generalizza e si registra in `INDEX.md`.
