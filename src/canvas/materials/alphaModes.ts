import type { Material } from 'three'

// Le tre vie per i bordi alpha (ROADMAP «Alpha-edge recipe», tutte verificate su WebGPU 0.184+).
// La scelta è una decisione, non un default: ogni via ha il suo requisito di AA.
//
// | via              | quando                          | requisito                        |
// |------------------|---------------------------------|----------------------------------|
// | alphaHash        | fogliame denso, dissolvenze     | TAA/TRAA in post (o accetti il   |
// |                  | senza sorting                   | dithering visibile)              |
// | alphaToCoverage  | reticoli/griglie con MSAA       | antialias:true (samples 4)       |
// | alphaTest        | cutout netti (foglie-card,      | niente — ma MAI transparent:true |
// |                  | scontornati)                    | con depthWrite (vedi sotto)      |
//
// Il gotcha pagato caro ([[webgpu-trasparente-occlusore-invisibile]]): un materiale transparent
// con depthWrite a opacità 0 è un occlusore invisibile — ritaglia ciò che ha dietro. Il cutout
// giusto è OPACO con alphaTest: il depth buffer riceve solo i pixel che sopravvivono al test.

/** Fogliame/dissolvenze: hash stocastico, NIENTE transparent, NIENTE sorting. Chiede TAA in post. */
export function asAlphaHashed<T extends Material>(material: T): T {
  material.transparent = false
  material.depthWrite = true
  material.alphaHash = true
  return material
}

/** Cutout netto (foglia-card, scontornato): opaco + alphaTest. 1/255 = «qualunque alpha > 0». */
export function asAlphaCutout<T extends Material>(material: T, threshold = 0.5): T {
  material.transparent = false
  material.depthWrite = true
  material.alphaTest = Math.max(threshold, 1 / 255)
  return material
}

/** Alpha-to-coverage: bordi morbidi via MSAA. Funziona SOLO con antialias:true (samples ≥ 4). */
export function asAlphaCoverage<T extends Material>(material: T): T {
  material.transparent = false
  material.depthWrite = true
  material.alphaToCoverage = true
  return material
}
