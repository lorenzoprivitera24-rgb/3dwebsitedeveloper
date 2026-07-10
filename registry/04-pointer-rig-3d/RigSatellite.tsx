import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, MathUtils } from 'three'
import type { Group, Mesh } from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { progressMap } from '../../src/scroll/progressMap'
import { TOKENS } from '../../src/lib/tokens.generated'

// Profondità del rig nella scena persistente: davanti alla forma (origine), ben dentro il
// frustum della camera del capitolo finale (z≈6.5+). Vincolo di composizione 3D, non un
// valore visivo di brand (quelli arrivano SOLO dai token).
const RIG_Z = 2.3

// (pointer: coarse) reattivo — su touch l'inseguimento passa allo scroll (niente gyro in v1).
function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(pointer: coarse)').matches
  })
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    const onChange = () => setCoarse(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return coarse
}

interface Props {
  reduced: boolean
}

// Blueprint 04 (lato scena) — satellite della MorphingForm che insegue il puntatore.
// NON scrive camera né sceneTargets: calcola i PROPRI target (posizione/tilt/presenza) e li
// dampa nel proprio useFrame — unico owner del gruppo (regola one-owner del kit).
// La presenza è gated da progressMap.pointer: il satellite esiste a video solo nella sua sezione.
export function RigSatellite({ reduced }: Props) {
  const coarse = useCoarsePointer()
  const groupRef = useRef<Group>(null)
  const ringRef = useRef<Mesh>(null)

  // Puntatore letto a livello window: l'overlay DOM (.content) copre il canvas fixed, quindi
  // gli eventi pointer non raggiungono l'elemento canvas e state.pointer non si aggiornerebbe.
  // Scrittura passiva in un ref (mai React state a 60fps); il damping resta nell'useFrame
  // (un solo RAF: Lenis + gsap.ticker + il loop R3F già esistente).
  const pointerRef = useRef({ x: 0, y: 0 })
  useEffect(() => {
    if (reduced || coarse) return
    const onMove = (e: PointerEvent) => {
      pointerRef.current.x = (e.clientX / window.innerWidth) * 2 - 1
      pointerRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [reduced, coarse])

  // Stessa famiglia di materiale della forma; colori SOLO dai token (bg2 + gradient.c).
  const material = useMemo(
    () =>
      new MeshStandardNodeMaterial({
        color: new Color(TOKENS.colors.bg2),
        roughness: 0.22,
        metalness: 0.1,
        emissive: new Color(TOKENS.gradient.c),
        emissiveIntensity: 0,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])

  useFrame((state, delta) => {
    const g = groupRef.current
    if (!g) return
    const p = progressMap.pointer

    // presenza: rampa dentro/fuori la sezione (fuori il satellite non esiste a video)
    const inSection = p > 0.08 && p < 0.92 ? 1 : 0
    const presence = reduced
      ? inSection
      : MathUtils.smoothstep(p, 0.04, 0.22) * (1 - MathUtils.smoothstep(p, 0.82, 0.98))

    // span sicuro derivato dal frustum reale alla profondità del rig: la camera del capitolo
    // finale arretra sui viewport stretti (aspect < 1) e il rig non deve mai uscire di scena
    const cam = state.camera
    const fov = 'fov' in cam && typeof cam.fov === 'number' ? cam.fov : 45
    const aspect = 'aspect' in cam && typeof cam.aspect === 'number' ? cam.aspect : 1
    const dist = Math.max(cam.position.z - RIG_Z, 1)
    const halfH = Math.tan(MathUtils.degToRad(fov / 2)) * dist
    const spanX = Math.min(halfH * aspect * 0.62, 1.9)
    const spanY = Math.min(halfH * 0.42, 1)

    let tx: number
    let ty: number
    let rx: number
    let ry: number
    if (reduced) {
      // posa composta, ferma: l'equivalente statico dignitoso
      tx = spanX * 0.6
      ty = 0.15
      rx = -0.18
      ry = 0.35
    } else if (coarse) {
      // touch: l'inseguimento passa allo scroll progress della sezione (traversata dolce)
      const t = MathUtils.smoothstep(p, 0.12, 0.88)
      tx = MathUtils.lerp(-spanX * 0.8, spanX * 0.8, t)
      ty = Math.sin(p * Math.PI) * spanY * 0.6 - 0.1
      rx = -0.15
      ry = MathUtils.lerp(-0.45, 0.45, t)
    } else {
      // desktop: insegue il puntatore, tilt sottile proporzionale
      tx = pointerRef.current.x * spanX
      ty = pointerRef.current.y * spanY
      rx = -pointerRef.current.y * 0.3
      ry = pointerRef.current.x * 0.45
    }

    // i target si dampano QUI, nel proprio useFrame (il rig non tocca MAI la camera)
    const bob = reduced ? 0 : Math.sin(state.clock.elapsedTime * 0.9) * 0.04
    const lambda = reduced ? 2 : 5
    g.position.x = MathUtils.damp(g.position.x, tx, lambda, delta)
    g.position.y = MathUtils.damp(g.position.y, ty + bob, lambda, delta)
    g.rotation.x = MathUtils.damp(g.rotation.x, rx, 4, delta)
    g.rotation.y = MathUtils.damp(g.rotation.y, ry, 4, delta)

    const s = MathUtils.damp(g.scale.x, presence, reduced ? 2 : 4, delta)
    g.scale.setScalar(Math.max(s, 1e-4))
    g.visible = s > 0.02
    material.emissiveIntensity = MathUtils.damp(material.emissiveIntensity, presence * 0.55, 4, delta)

    // vita minima del rig: l'anello ruota piano (owner: questo componente)
    if (!reduced && ringRef.current) ringRef.current.rotation.z += delta * 0.2
  })

  return (
    <group ref={groupRef} position={[0, 0, RIG_Z]} scale={1e-4} visible={false}>
      <mesh material={material}>
        <icosahedronGeometry args={[0.3, 3]} />
      </mesh>
      <mesh ref={ringRef} material={material} rotation={[Math.PI / 2.4, 0.5, 0]}>
        <torusGeometry args={[0.52, 0.02, 12, 72]} />
      </mesh>
    </group>
  )
}
