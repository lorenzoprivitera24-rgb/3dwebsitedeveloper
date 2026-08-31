'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three/webgpu'
import { MathUtils } from 'three'
import { Canvas, extend, useFrame, type ThreeToJSXElements } from '@react-three/fiber'
import { mix, mx_noise_float, normalLocal, positionLocal, time, uniform, vec3 } from 'three/tsl'

declare module '@react-three/fiber' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
extend(THREE as any)

// La scena minima dello starter: la stessa grammatica del kit (WebGPURenderer con init
// asincrono + fallback WebGL2 automatico, AgX, materiale TSL, damp) ridotta all'osso. Un
// progetto cliente la sostituisce in blocco con la propria — il contratto da conservare è il
// CONFINE (CanvasShell), non questa forma.
function MorphingBlob({ reduced }: { reduced: boolean }) {
  const uAmp = useMemo(() => uniform(reduced ? 0.04 : 0), [reduced])

  const material = useMemo(() => {
    const m = new THREE.MeshStandardNodeMaterial()
    const n = mx_noise_float(positionLocal.mul(1.6).add(vec3(0, time.mul(0.25), 0)))
    m.positionNode = positionLocal.add(normalLocal.mul(n.mul(uAmp)))
    m.colorNode = mix(vec3(0.16, 0.24, 0.55), vec3(0.36, 0.55, 1.0), n.add(0.5))
    m.roughness = 0.35
    m.metalness = 0.15
    return m
  }, [uAmp])

  useFrame((_, delta) => {
    if (reduced) return
    // easing della comparsa: l'ampiezza insegue il target, mai un salto (regola 5 del kit)
    uAmp.value = MathUtils.damp(uAmp.value as number, 0.22, 2, delta)
  })

  return (
    <mesh material={material}>
      <icosahedronGeometry args={[1.4, 48]} />
    </mesh>
  )
}

export default function CanvasScene() {
  const [reduced, setReduced] = useState(false)
  const failed = useRef(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const on = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  if (failed.current) return null // il poster HTML sotto resta: nessun canvas vuoto

  return (
    <Canvas
      gl={async (props) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const renderer = new THREE.WebGPURenderer({ ...(props as any), antialias: true })
        await renderer.init() // WebGPU, o fallback WebGL2 automatico
        renderer.toneMapping = THREE.AgXToneMapping
        return renderer
      }}
      camera={{ position: [0, 0, 5], fov: 45 }}
      dpr={[1, 2]}
      onCreated={({ gl }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const backend = (gl as any).backend
        console.info('[starter] renderer backend:', backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL2')
      }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 4, 5]} intensity={1.6} />
      <MorphingBlob reduced={reduced} />
    </Canvas>
  )
}
