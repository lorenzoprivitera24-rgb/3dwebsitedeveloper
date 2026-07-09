# Storyboard — <progetto>

Data: <YYYY-MM-DD> · Input: `brief.md` + `direction.md` + `registry/INDEX.md` · Owner: scroll-storyboarder
**La scena WebGL è UNA e persistente: descrivi le transizioni tra sezioni, non sezioni isolate.**
Massimo 8 sezioni salvo richiesta diversa.

---

## S<N> — <nome sezione>
- **Blueprint**: `<id dal registro>` | `CUSTOM: <descrizione per r3f-scene-architect>`
- **Scena 3D (stato A → stato B)**: camera <da → a>, oggetti <…>, materiali/uniform <…>
- **Trigger e durata**: start <…>, end <…>, `<N>vh`, pin sì/no, scrub sì/no
- **Slot copy richiesti**: eyebrow · headline · sub · <altri>  → `content/<NN>-<slug>.json`
- **Mobile**: <cosa cambia: poster? timeline ridotta? istanze dimezzate?>
- **Reduced-motion**: <stato statico equivalente>

(ripetere per ogni sezione, nell'ordine di scroll)

---

## Transizioni tra sezioni
- S1→S2: <cosa fa la camera/materiale nel passaggio, chi possiede il progress>
- …

## Checklist completezza
- [ ] Ogni sezione ha blueprint del registro o CUSTOM con specifica
- [ ] Il progress di ogni sezione ha UN solo owner (one-owner rule)
- [ ] Slot copy = esattamente quelli che content/*.json dovrà riempire
- [ ] Mobile e reduced-motion definiti per OGNI sezione
- [ ] Somma durate ≈ lunghezza pagina ragionevole (< ~12 viewport totali)
