import { float, mx_noise_float, positionWorld, sin, time, vec2, vec3 } from 'three/tsl'

export interface WindOptions {
  /** Strati attivi (dal tier: windOctaves 1-3). 1 = solo oscillazione globale. */
  octaves?: number
  /** Ampiezza complessiva in unità scena. */
  strength?: number
  /** Fase per-instance (0..1, tipicamente aHash): rompe la sincronia tra istanze. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  phase?: any
  /**
   * Maschera d'altezza (0 alla radice, 1 in punta): tipicamente uv().y o la Y locale
   * normalizzata. SENZA maschera anche la radice ondeggia e l'oggetto «pattina» sul terreno.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  heightMask?: any
}

// Vento TSL multi-strato (ROADMAP «Multi-layer TSL wind node», reference realistic-foliage.md):
// UNA sinusoide si legge come metronomo — il vero vento è la somma di tre moti a frequenze
// diverse. Strati:
//   1. sway globale   — oscillazione lenta coerente su tutta la scena (direzione X dominante)
//   2. fronte di raffica — rumore che AVANZA nello spazio mondo: le raffiche arrivano, non pulsano
//   3. turbolenza     — jitter ad alta frequenza sfasato per istanza (phase)
// Ritorna un offset vec3 da SOMMARE a positionLocal nel positionNode del materiale; il costo è
// tutto in vertex shader. L'owner dell'animazione è il nodo `time`: nessun uniform da scrivere
// a mano, nessun secondo RAF (regola 3).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function windOffset({ octaves = 3, strength = 0.12, phase, heightMask }: WindOptions = {}): any {
  const mask = heightMask ?? float(1)
  const ph = phase ?? float(0)
  const s = float(strength)

  // 1 — sway globale: lento, coerente, leggermente diverso lungo X mondo per non essere un muro
  // (intermedi type-erased: i generics TSL r185 si rompono sulle catene lunghe, cfr. gradientField.ts:58)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let x: any = sin(time.mul(1.1).add(positionWorld.x.mul(0.35)).add(ph.mul(6.28))).mul(0.6)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let z: any = sin(time.mul(0.9).add(positionWorld.z.mul(0.3)).add(ph.mul(6.28))).mul(0.25)

  if (octaves >= 2) {
    // 2 — fronte di raffica: il campo di rumore trasla nel tempo lungo X (le raffiche viaggiano)
    const gust = mx_noise_float(
      vec2(positionWorld.x.mul(0.18).sub(time.mul(0.5)), positionWorld.z.mul(0.18)),
    )
    x = x.add(gust.mul(0.8))
    z = z.add(gust.mul(0.3))
  }

  if (octaves >= 3) {
    // 3 — turbolenza per-istanza: frequenza alta, ampiezza piccola, fase dall'hash
    const turb = mx_noise_float(vec2(time.mul(2.4).add(ph.mul(37.7)), positionWorld.x.mul(1.7)))
    x = x.add(turb.mul(0.25))
    z = z.add(turb.mul(0.2))
  }

  // la maschera d'altezza entra al quadrato: la punta balla, la radice resta piantata
  const m = mask.mul(mask).mul(s)
  return vec3(x.mul(m), 0, z.mul(m))
}
