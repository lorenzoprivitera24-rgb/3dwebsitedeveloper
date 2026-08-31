// Registro delle sonde QA: i materiali pubblicano qui il valore CORRENTE dei propri uniform,
// così il gate di stato può verificare la convergenza uniform → sceneTargets senza che nessuno
// debba esporre il materiale (che resta di proprietà del suo unico owner — regola one-owner).
//
// Costo in produzione: una scrittura in un oggetto al mount e una `delete` allo smontaggio.
// Il ponte `window.__qa` invece non si installa affatto senza `?qa=1`.
export type QaProbe = () => number | number[]

export const qaProbes: Record<string, QaProbe> = {}

/** Registra una sonda; ritorna la funzione di rimozione (da chiamare nel cleanup). */
export function registerQaProbe(name: string, get: QaProbe): () => void {
  qaProbes[name] = get
  return () => {
    delete qaProbes[name]
  }
}
