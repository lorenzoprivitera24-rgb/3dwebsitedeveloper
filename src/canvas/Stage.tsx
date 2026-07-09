import * as THREE from 'three/webgpu'
import { Canvas, extend, type ThreeToJSXElements } from '@react-three/fiber'
import { Component, Suspense, type ReactNode } from 'react'
import { Poster } from './Poster'
import { DevPerf } from './DevPerf'

// Make the WebGPU build's primitives and node materials available as JSX elements.
declare module '@react-three/fiber' {
  // Canonical R3F v9 augmentation: the "empty" interface IS the declaration merge.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
extend(THREE as any)

// If the renderer crashes at runtime (very old GPU, driver bug), show the poster instead of a blank canvas.
class CanvasErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error: unknown) {
    console.error('Canvas failed, falling back to poster:', error)
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

interface StageProps {
  children: ReactNode
  dpr: [number, number]
  /** Artistic exposure dial for the house tonemapper (AgX). 1 = neutral. */
  toneMappingExposure?: number
}

export function Stage({ children, dpr, toneMappingExposure = 1 }: StageProps) {
  return (
    <CanvasErrorBoundary fallback={<Poster />}>
      <Canvas
        // R3F v9: the gl prop may return a Promise, which lets WebGPURenderer await init().
        // WebGPURenderer.init() falls back to WebGL2 automatically when WebGPU is unavailable.
        gl={async (props) => {
          // AA decision (verified): antialias:true → WebGPURenderer samples=4, and the scene
          // PassNode honors it, so MSAA also multisamples the off-screen pass when post FX
          // arrives. Swap to SMAA/TRAA in post only when shader/alpha aliasing dominates —
          // never hardcode antialias:false "because post".
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const renderer = new THREE.WebGPURenderer({ ...(props as any), antialias: true })
          await renderer.init()
          // House output transform: AgX tonemapping (neutral filmic highlights; ACESFilmic is
          // the documented alternative) + exposure as the one artistic dial. Set AFTER init().
          renderer.toneMapping = THREE.AgXToneMapping
          renderer.toneMappingExposure = toneMappingExposure
          return renderer
        }}
        camera={{ position: [0, 0, 6], fov: 45 }}
        dpr={dpr}
      >
        <Suspense fallback={null}>{children}</Suspense>
        <DevPerf />
      </Canvas>
    </CanvasErrorBoundary>
  )
}
