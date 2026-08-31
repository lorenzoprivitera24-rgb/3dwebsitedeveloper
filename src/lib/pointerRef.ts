import { useEffect } from 'react'

// Segnale puntatore CONDIVISO per la scena persistente.
//
// Perché esiste: l'overlay DOM (`.content`, z-index 1) copre il canvas fixed, quindi gli
// eventi pointer non raggiungono MAI l'elemento canvas e `state.pointer` di R3F resta fermo
// a (0,0) (verificato con document.elementFromPoint al centro del viewport). L'alternativa
// `eventSource`/`eventPrefix` sul Canvas può impostare `touch-action: none` sull'elemento
// sorgente e rompere lo scroll touch — questo modulo evita il rischio: UN solo listener
// `pointermove` a livello window scrive le coordinate NDC in un ref di modulo.
//
// Contratto (stesse regole del kit):
// - i consumer canvas leggono `pointerSignal` nel PROPRIO `useFrame` e dampano i PROPRI
//   uniform/target (un owner per proprietà; niente React state a 60fps; nessun RAF extra);
// - listener passivo, mai preventDefault: lo scroll touch resta intatto;
// - `pointerdown` incluso così anche un tap su touch aggiorna il segnale (sul drag il
//   browser prende lo scroll e il valore si congela sull'ultimo punto toccato: voluto).
export interface PointerSignal {
  /** NDC: -1..1, +x a destra */
  x: number
  /** NDC: -1..1, +y in alto */
  y: number
  /** false finché non arriva il primo evento (o dopo blur della finestra) */
  active: boolean
}

export const pointerSignal: PointerSignal = { x: 0, y: 0, active: false }

let consumers = 0

function onMove(e: PointerEvent) {
  pointerSignal.x = (e.clientX / window.innerWidth) * 2 - 1
  pointerSignal.y = -(e.clientY / window.innerHeight) * 2 + 1
  pointerSignal.active = true
}

function onBlur() {
  pointerSignal.active = false
}

/**
 * Registra (una sola volta, reference-counted) il listener window e restituisce il ref
 * condiviso. Leggerlo dentro `useFrame`; NON metterlo in dipendenze/state.
 */
export function usePointerSignal(): PointerSignal {
  useEffect(() => {
    if (consumers === 0) {
      window.addEventListener('pointermove', onMove, { passive: true })
      window.addEventListener('pointerdown', onMove, { passive: true })
      window.addEventListener('blur', onBlur)
    }
    consumers += 1
    return () => {
      consumers -= 1
      if (consumers === 0) {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerdown', onMove)
        window.removeEventListener('blur', onBlur)
      }
    }
  }, [])
  return pointerSignal
}
