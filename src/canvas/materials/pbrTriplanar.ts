import type { Texture } from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { float } from 'three/tsl'
import { triplanar, triplanarDualScale } from '../tsl/triplanar'

export interface PbrTriplanarOptions {
  /** Albedo (KTX2 ETC1S o qualunque Texture). Ricorda colorSpace = SRGBColorSpace. */
  albedoMap: Texture
  /** Roughness (canale singolo; KTX2 UASTC per i data map). */
  roughnessMap?: Texture
  /** Scala mondo della proiezione (unità scena per ripetizione). */
  scale?: number
  /** Nitidezza della fusione tra i piani (8 default). */
  sharpness?: number
  /** Doppia scala mondo anti-tiling (6 sample invece di 3): per superfici grandi in primo piano. */
  dualScale?: boolean
  roughness?: number
  metalness?: number
}

// Il primitivo materiale della ROADMAP NEXT: PBR + triplanar, da dare in pasto a KTX2.
// NOTA normal map: il triplanar delle normali richiede la riorientazione per piano (swizzle/UDN)
// e su WebGPU va verificato a schermo caso per caso — qui NON è incluso di proposito: meglio
// nessuna normale che una normale ruotata male (il tell «plasticoso» si vede subito). Quando
// serve, la scheda è in references/realism-and-interactivity.md.
export function makePbrTriplanarMaterial({
  albedoMap,
  roughnessMap,
  scale = 1,
  sharpness = 8,
  dualScale = false,
  roughness = 1,
  metalness = 0,
}: PbrTriplanarOptions): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial()
  const sample = dualScale
    ? (t: Texture) => triplanarDualScale(t, scale, scale * 0.31, sharpness)
    : (t: Texture) => triplanar(t, scale, sharpness)

  material.colorNode = sample(albedoMap)
  material.roughnessNode = roughnessMap ? sample(roughnessMap).r.mul(float(roughness)) : float(roughness)
  material.metalness = metalness
  return material
}
