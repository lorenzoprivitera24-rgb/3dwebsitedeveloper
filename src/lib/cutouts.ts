// Il contratto fra scripts/encode-cutouts.mjs e i blueprint a strati (13, 14, 07).
// Il manifesto è GENERATO: qui si dichiara solo come si legge.

export interface CutoutSource {
  w: number
  src: string
}

export interface CutoutLayer {
  /** nome file senza estensione, es. "02-nucleo" — è anche la chiave delle note di copy */
  id: string
  /** etichetta derivata dal nome file; la copy vera la sovrascrive */
  label: string
  /**
   * Dove sta l'inchiostro dentro il box condiviso, in frazioni 0→1.
   * `y` è la BASE dell'inchiostro (dove lo strato appoggia), non il centro: serve a piazzare
   * l'ombra di contatto e a mettere l'annotazione alla stessa quota dello strato.
   */
  ink: { x: number; y: number; w: number; h: number }
  shadow: string | null
  sources: { avif: CutoutSource[]; webp: CutoutSource[] }
}

export interface CutoutProduct {
  id: string
  /** larghezza/altezza del box condiviso — tutti gli strati hanno queste proporzioni */
  aspect: number
  box: { width: number; height: number }
  /** ordine: dal BASSO verso l'ALTO della pila fisica */
  layers: CutoutLayer[]
  bytes?: number
}

export interface CutoutManifest {
  note?: string
  widths: number[]
  products: Record<string, CutoutProduct>
}

/** srcSet pronto da dare a <source>/<img>. */
export const srcSet = (sources: CutoutSource[]) =>
  sources.map((s) => `${s.src} ${s.w}w`).join(', ')

/** la sorgente più grande, come `src` di fallback per browser senza srcset. */
export const largest = (sources: CutoutSource[]) => sources[sources.length - 1]?.src ?? ''

/**
 * Centro verticale dell'inchiostro, in frazione del box: `ink.y` è la base, quindi il centro
 * sta mezza altezza più su. È la quota a cui va agganciata l'annotazione dello strato.
 */
export const inkCenterY = (layer: CutoutLayer) => layer.ink.y - layer.ink.h / 2
