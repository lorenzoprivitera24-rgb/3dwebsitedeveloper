// Il contratto scroll→scena della demo composta (pattern «progress map + camera director»,
// skill scroll-scene-choreography): ogni blueprint DOM scrive SOLO il proprio canale qui
// (via useSectionProgress); l'unico consumatore è il CameraDirector. Ref-like, mai React state.
//
// L'ORDINE di questa unione è l'ordine in pagina, e conta: il CameraDirector si passa il
// testimone fra tratte consecutive dando per scontato che, quando la sezione N ha progresso > 0,
// la N-1 sia già a 1. Se sposti una sezione nel DOM, spostala anche qui e nella regia.
export type SectionKey =
  | 'hero'
  | 'gradient'
  | 'scrub'
  | 'gallery'
  | 'strip'
  | 'card'
  | 'kinetic'
  | 'footer'

export const progressMap: Record<SectionKey, number> = {
  hero: 0,
  gradient: 0,
  scrub: 0,
  gallery: 0,
  strip: 0,
  card: 0,
  kinetic: 0,
  footer: 0,
}
