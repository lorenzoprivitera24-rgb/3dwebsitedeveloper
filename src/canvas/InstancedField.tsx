import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { Color, InstancedBufferAttribute, MathUtils, Matrix4, Quaternion, Vector3 } from 'three'
import { attribute, color, mix, positionLocal, uv } from 'three/tsl'
import { windOffset } from './tsl/wind'

interface Props {
  /** Numero di istanze — il chiamante lo prende dal tier (particleCount o un budget dedicato). */
  count: number
  /** Lato dell'area quadrata di scatter, in unità scena. */
  area?: number
  /** Strati di vento dal tier (windOctaves). */
  windOctaves?: number
  /** Colori radice→punta della variazione per-istanza. */
  baseColor?: string
  tipColor?: string
  reduced?: boolean
}

// PRNG seminato (mulberry32): lo scatter DEVE essere deterministico — i gate pixel confrontano
// screenshot, e un campo che cambia a ogni mount renderebbe ogni diff un falso positivo.
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// «L'instancing esiste nel codice» (ROADMAP NEXT): InstancedMesh NATIVO — non drei <Instances>,
// che sopra ~1-2k istanze paga un overhead CPU misurato (dossier photoreal §1). Attributi
// per-istanza (hash) letti dal TSL per fase del vento e variazione di colore: una mesh ripetuta
// si legge come tanti individui di una specie, non come un timbro.
export function InstancedField({
  count,
  area = 14,
  windOctaves = 3,
  baseColor = '#1c3a2a',
  tipColor = '#7ba05b',
  reduced = false,
}: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  // geometry + hash per-istanza, ricreate SOLO al cambio di count
  const { geometry, hashes } = useMemo(() => {
    // lama affusolata: cono a 4 lati, pivot alla base (translate +0.5) così lo scale non affonda
    const g = new THREE.ConeGeometry(0.035, 1, 4, 3)
    g.translate(0, 0.5, 0)
    const rand = mulberry32(20260831)
    const h = new Float32Array(count)
    for (let i = 0; i < count; i++) h[i] = rand()
    g.setAttribute('aHash', new InstancedBufferAttribute(h, 1))
    return { geometry: g, hashes: h }
  }, [count])

  const material = useMemo(() => {
    const m = new THREE.MeshStandardNodeMaterial()
    // type-erasure: i generics TSL r185 non danno operatori ad AttributeNode (cfr. gradientField.ts:58)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = attribute('aHash') as any
    // gradiente radice→punta lungo la Y locale (uv.y sul cono) + jitter di tinta dall'hash
    const grad = mix(color(new Color(baseColor)), color(new Color(tipColor)), uv().y)
    m.colorNode = grad.mul(hash.mul(0.3).add(0.85))
    m.roughness = 0.9
    if (!reduced) {
      // il vento è tutto in vertex shader; la maschera d'altezza è la Y locale (base=0, punta=1)
      m.positionNode = positionLocal.add(
        windOffset({ octaves: windOctaves, strength: 0.35, phase: hash, heightMask: uv().y }),
      )
    }
    return m
  }, [windOctaves, reduced, baseColor, tipColor])

  // GOTCHA pagato caro ([[web3d-instanced-tier-matrici-azzerate]]): al cambio di count la mesh
  // RIMONTA (key sotto) e il buffer delle matrici rinasce azzerato — tutte le istanze collassano
  // nell'origine. Le matrici vanno riscritte in un layout effect che dipende da count, sul ref
  // NUOVO. Scatter deterministico: stesso seed dell'hash, così il campo è identico a ogni run.
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const rand = mulberry32(20260831 ^ 0x9e3779b9)
    const mat = new Matrix4()
    const pos = new Vector3()
    const quat = new Quaternion()
    const scale = new Vector3()
    const up = new Vector3(0, 1, 0)
    for (let i = 0; i < count; i++) {
      pos.set((rand() - 0.5) * area, 0, (rand() - 0.5) * area)
      quat.setFromAxisAngle(up, rand() * Math.PI * 2)
      const s = MathUtils.lerp(0.6, 1.4, hashes[i])
      scale.set(s, s * MathUtils.lerp(0.8, 1.6, rand()), s)
      mat.compose(pos, quat, scale)
      mesh.setMatrixAt(i, mat)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [count, area, hashes])

  return (
    <instancedMesh
      key={count}
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
    />
  )
}
