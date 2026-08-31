import type { Texture } from 'three'
import { abs, float, normalWorld, positionWorld, texture, vec3 } from 'three/tsl'

// Triplanar sampling (ROADMAP «PBR + triplanar material primitive»): proietta la texture sui tre
// piani mondo e fonde con i pesi della normale — la cura n°1 contro il tiling che si vede
// (reference: realism-and-interactivity.md §A.2). `sharpness` alza i pesi a potenza: più alto,
// più netta la separazione tra i piani (8 è un buon default; 1 = fusione morbida che «spalma»).
//
// Renderer-agnostico: compila in WGSL e GLSL. Nessuna UV richiesta: usa positionWorld, quindi
// funziona anche su geometria generata/instanziata senza unwrap.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function triplanar(map: Texture, scale = 1, sharpness = 8): any {
  const p = positionWorld.mul(float(scale))
  const n = abs(normalWorld).pow(float(sharpness))
  const w = n.div(n.x.add(n.y).add(n.z)) // pesi normalizzati: x+y+z = 1

  const xProj = texture(map, p.zy)
  const yProj = texture(map, p.xz)
  const zProj = texture(map, p.xy)
  return xProj.mul(w.x).add(yProj.mul(w.y)).add(zProj.mul(w.z))
}

// Doppia scala mondo per dissolvere il tiling residuo: la stessa mappa a due frequenze, fusa a
// metà. Costa 6 sample invece di 3 — riservala alle superfici grandi inquadrate da vicino.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function triplanarDualScale(map: Texture, scaleA = 1, scaleB = 0.31, sharpness = 8): any {
  const a = triplanar(map, scaleA, sharpness)
  const b = triplanar(map, scaleB, sharpness)
  return a.mul(vec3(0.5)).add(b.mul(vec3(0.5)))
}
