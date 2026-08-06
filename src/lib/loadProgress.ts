// Asset-loading progress, published by the canvas chunk and read by the DOM shell.
//
// WHY THIS EXISTS (bundling, not features): the preloader is a DOM component and therefore lives
// in the entry chunk. It used to call drei's `useProgress` directly, which made `three` reachable
// from the entry's STATIC import graph — so the canvas chunk was preloaded on first paint and the
// code-split was cosmetic (599 KB gzip of "split" JS still blocking first paint).
//
// The fix is to invert the direction of the dependency: this module has NO imports, the canvas
// publishes into it from inside its own lazily-loaded chunk (see LoadProgressBridge), and the DOM
// reads it with useSyncExternalStore. Nothing in the entry graph mentions three.
//
// Keep this file dependency-free. A single import of three/R3F/drei here re-creates the bug.

type Listener = () => void

let progress = 0
let canvasMounted = false
let loading = false
const listeners = new Set<Listener>()

function notify() {
  for (const listener of listeners) listener()
}

export function subscribeLoadProgress(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getLoadProgress(): number {
  return progress
}

/** Called from the canvas chunk. No-ops on an unchanged value so React does not re-render. */
export function publishLoadProgress(value: number): void {
  const next = Math.max(0, Math.min(100, value))
  if (next === progress) return
  progress = next
  notify()
}

/**
 * Il chunk del canvas è arrivato ed è montato. Serve al preloader per distinguere «non ci sono
 * asset da caricare» (alza il sipario) da «il canvas non è ancora sceso dalla rete» (aspetta): il
 * suo failsafe a 4s altrimenti alza il sipario su una scena vuota — invisibile qui, quotidiano su
 * una connessione lenta e sistematico in dev, dove il grafo dei moduli si compila a freddo.
 */
export function publishCanvasMounted(): void {
  if (canvasMounted) return
  canvasMounted = true
  notify()
}

export function getCanvasMounted(): boolean {
  return canvasMounted
}

/**
 * C'è almeno un asset in volo (drei `useProgress().active`). A cache calda non parte NULLA: il
 * progresso resta 0 per sempre e senza questo segnale il sipario resterebbe giù fino al failsafe —
 * quattro secondi di attesa proprio al visitatore di ritorno, quello che aspetta meno di tutti.
 */
export function publishLoading(value: boolean): void {
  if (value === loading) return
  loading = value
  notify()
}

export function getLoading(): boolean {
  return loading
}
