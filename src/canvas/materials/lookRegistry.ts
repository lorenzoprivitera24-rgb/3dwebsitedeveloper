import type { GradientLookUniforms } from './gradientField'

// Le uniform vivono dentro il Canvas; il pannello Leva è DOM e sta fuori (dentro il Canvas il
// reconciler di R3F si aspetta oggetti three, non elementi HTML). Questo registro è il punto di
// incontro: il componente della scena si iscrive al mount, il pannello scrive quando giri una
// manopola. Nessun costo per frame — sono assegnazioni dirette sulle uniform.
//
// Vive solo per l'accordatura in dev. In produzione il pannello non viene compilato e nessuno
// legge questo registro; la scena prende i suoi valori dal JSON e basta.

let gradient: GradientLookUniforms | null = null

export function registerGradientLook(uniforms: GradientLookUniforms | null): void {
  gradient = uniforms
}

export function getGradientLook(): GradientLookUniforms | null {
  return gradient
}
