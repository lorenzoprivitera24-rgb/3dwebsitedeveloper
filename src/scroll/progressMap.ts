// Il contratto scroll→scena della demo composta (pattern «progress map + camera director»,
// skill scroll-scene-choreography): ogni blueprint DOM scrive SOLO il proprio canale qui
// (via useSectionProgress); l'unico consumatore è il CameraDirector. Ref-like, mai React state.
export type SectionKey = 'hero' | 'gradient' | 'scrub' | 'kinetic'

export const progressMap: Record<SectionKey, number> = {
  hero: 0,
  gradient: 0,
  scrub: 0,
  kinetic: 0,
}
