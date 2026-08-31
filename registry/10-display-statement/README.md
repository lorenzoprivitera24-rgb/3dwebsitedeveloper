# 10 · display-statement

La punteggiatura editoriale: UNA frase, campo lungo, poi si riparte.

```tsx
<DisplayStatement copy={statementCopy} reduced={reduced} />
```

## Due movimenti, due nature (stessa grammatica del 07)

| cosa | natura | come |
|---|---|---|
| reveal delle righe | ENTRA (toggle) | ogni riga sale da dietro una maschera `overflow:hidden` |
| foto sotto | DERIVA (scrub) | `fromTo` yPercent -8→8: testo fermo su fondo che scorre = lastra incisa |

Una dichiarazione non si scrubba — o è detta o non lo è. Senza `image` nel copy monta un
placeholder generato (nessun asset richiesto). `reduced` = tutto fermo e già visibile.
