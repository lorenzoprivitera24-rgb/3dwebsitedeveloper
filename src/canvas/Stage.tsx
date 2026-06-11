import * as THREE from 'three/webgpu'
import { Canvas, extend, type ThreeToJSXElements } from '@react-three/fiber'
import { Component, Suspense, type ReactNode } from 'react'
import { Poster } from './Poster'

// Make the WebGPU build's primitives and node materials available as JSX elements.
declare module '@react-three/fiber' {
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
  fallback?: ReactNode
}

/**
 * Fullscreen WebGPU stage.
 *
 * The `gl` prop is an async factory (R3F v9 supports a Promise) so WebGPURenderer can await
 * init(); it falls back to WebGL2 automatically, so the same TSL materials run on both backends.
 *
 * frameloop="always": this is a LIVE simulation (day/night cycle + traffic), never idle, so
 * on-demand rendering does not apply. Per-frame cost is controlled by the quality tier instead.
 */
export function Stage({ children, dpr, fallback }: StageProps) {
  return (
    <CanvasErrorBoundary fallback={fallback ?? <Poster />}>
      <Canvas
        gl={async (props) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const renderer = new THREE.WebGPURenderer({ ...(props as any), antialias: true })
          await renderer.init()
          return renderer
        }}
        // A real perspective camera framed for a city; CameraRig takes ownership after mount.
        camera={{ position: [120, 90, 120], fov: 50, near: 0.5, far: 6000 }}
        dpr={dpr}
        frameloop="always"
        shadows={false} // shadow map is configured imperatively in RendererConfig per tier
      >
        <Suspense fallback={null}>{children}</Suspense>
      </Canvas>
    </CanvasErrorBoundary>
  )
}
