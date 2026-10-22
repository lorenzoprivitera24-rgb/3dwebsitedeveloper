import { useEffect, useMemo } from 'react'
import { DataTexture, RGBAFormat, SRGBColorSpace } from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { float, normalLocal, positionLocal, uniform, vec3 } from 'three/tsl'
import { Stage } from '../canvas/Stage'
import { makePbrTriplanarMaterial } from '../canvas/materials/pbrTriplanar'
import { windOffset } from '../canvas/tsl/wind'

// Il laboratorio delle costanti TSL (?lab=costanti): il controllo negativo delle «famiglie» di
// `qa:compilazioni` (references/webgpu-tsl.md §6). Due file di sei superfici, sei misure diverse:
//   sopra, un grafo minimo che porta la misura in vertex (spostamento) e in fragment (tinta);
//   sotto, le fabbriche del kit (triplanar + vento) con sei scale, rugosità e forze diverse.
// Di norma le misure sono `uniform`: il codice è uguale per tutte, UN programma per fila.
// Con `&costanti=cotte` la fila di sopra le cuoce come letterali (`float(k)`), il difetto che
// SILKET aveva nelle parti che germinano: sei programmi uguali a meno di un numero, e il gate deve
// nominarli come una famiglia. La fila di sotto resta com'è: le fabbriche del kit non devono mai
// farne.

const cotte = new URLSearchParams(window.location.search).get('costanti') === 'cotte'
const MISURE = [0.5, 0.75, 1, 1.25, 1.5, 1.75]

function albedo(): DataTexture {
  const tex = new DataTexture(new Uint8Array([200, 120, 80, 255, 90, 110, 160, 255, 90, 110, 160, 255, 200, 120, 80, 255]), 2, 2, RGBAFormat)
  tex.colorSpace = SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function Superfici() {
  const tex = useMemo(albedo, [])
  const materiali = useMemo(() => {
    const valore = (k: number) => (cotte ? float(k) : uniform(k))
    const sopra = MISURE.map((k) => {
      const m = new MeshStandardNodeMaterial({ roughness: 0.6 })
      m.positionNode = positionLocal.add(normalLocal.mul(valore(k * 0.1)))
      m.colorNode = vec3(0.35, 0.5, 0.8).mul(valore(k))
      return m
    })
    const sotto = MISURE.map((k) => {
      const m = makePbrTriplanarMaterial({ albedoMap: tex, scale: k, roughness: 0.3 + k * 0.3 })
      m.positionNode = positionLocal.add(windOffset({ octaves: 1, strength: k * 0.05, heightMask: float(1) }))
      return m
    })
    return { sopra, sotto }
  }, [tex])

  useEffect(
    () => () => {
      for (const m of [...materiali.sopra, ...materiali.sotto]) m.dispose()
      tex.dispose()
    },
    [materiali, tex],
  )

  // Tre colonne, perché ci stiano anche nel quadro verticale di un telefono, e comunque mai
  // scartate dal frustum: three compila solo ciò che disegna, e la prima versione (sei in fila)
  // a taglia iPhone lasciava fuori quadro le due agli estremi, che non nascevano mai (21 ott 2026).
  const posa = (i: number, y0: number): [number, number, number] => [((i % 3) - 1) * 1, y0 - Math.floor(i / 3), 0]
  return (
    <>
      <directionalLight position={[3, 5, 4]} intensity={1.2} />
      {materiali.sopra.map((m, i) => (
        <mesh key={`sopra${i}`} material={m} position={posa(i, 1.6)} frustumCulled={false}>
          <boxGeometry args={[0.6, 0.6, 0.6]} />
        </mesh>
      ))}
      {materiali.sotto.map((m, i) => (
        <mesh key={`sotto${i}`} material={m} position={posa(i, -0.6)} frustumCulled={false}>
          <boxGeometry args={[0.6, 0.6, 0.6]} />
        </mesh>
      ))}
    </>
  )
}

export default function CostantiLab() {
  return (
    <div className="canvas-layer" aria-hidden="true" style={{ position: 'fixed', inset: 0 }}>
      <Stage dpr={[1, 1]} cameraPosition={[0, 0, 7]}>
        <Superfici />
      </Stage>
    </div>
  )
}
