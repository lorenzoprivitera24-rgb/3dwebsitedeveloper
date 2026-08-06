// Il contratto scroll→scena della demo composta (pattern «progress map + camera director»,
// skill scroll-scene-choreography): ogni blueprint DOM scrive SOLO il proprio canale qui
// (via useSectionProgress); l'unico consumatore è il CameraDirector. Ref-like, mai React state.
export type SectionKey = 'hero' | 'gradient' | 'scrub' | 'kinetic' | 'explode' | 'veil' | 'gallery'

export const progressMap: Record<SectionKey, number> = {
  hero: 0,
  gradient: 0,
  scrub: 0,
  kinetic: 0,
  // capitoli «prodotto a strati»: qui il protagonista è il DOM, la scena 3D deve farsi da parte
  explode: 0,
  veil: 0,
  gallery: 0,
}

/**
 * Il canale di AVVICINAMENTO: 0→1 mentre la sezione entra nel viewport, e arriva a 1 esattamente
 * quando comincia il suo pin.
 *
 * Serve perché in una sezione pinnata `progressMap` vale 0 al primo frame del pin — quando la
 * sezione occupa già tutto lo schermo. Una scena 3D che comincia a calmarsi lì si calma *sotto
 * gli occhi* di chi guarda, e il primo fotogramma della sezione è quello con più rumore dietro.
 * Con l'avvicinamento la scena è già quieta prima che il capitolo cominci.
 */
export const approachMap: Record<SectionKey, number> = {
  hero: 0,
  gradient: 0,
  scrub: 0,
  kinetic: 0,
  explode: 0,
  veil: 0,
  gallery: 0,
}
