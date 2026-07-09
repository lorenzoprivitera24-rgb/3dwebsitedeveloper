import { lazy, Suspense, useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

// Dev-only performance HUD — the tool that makes the perf auditor's budgets measurable.
//
// VERIFIED (browser QA, lug 2026): r3f-perf 7.x CRASHES on WebGPURenderer (GLPerf.initGpu
// assumes a WebGL context) and takes the whole canvas down with it. So:
//   - WebGPU backend → tiny built-in HUD reading renderer.info (fps / draw calls / triangles)
//   - WebGL2 fallback → real r3f-perf (lazy; devDependency)
// `import.meta.env.DEV` is statically false in production builds, so both branches are
// dead code there and Rollup drops them (r3f-perf never ships).

const Perf = import.meta.env.DEV
  ? lazy(() => import('r3f-perf').then((m) => ({ default: m.Perf })))
  : null

interface RendererInfoLike {
  backend?: { isWebGPUBackend?: boolean }
  info?: { render?: { calls?: number; drawCalls?: number; triangles?: number } }
}

function WebGpuHud() {
  const gl = useThree((s) => s.gl) as unknown as RendererInfoLike
  const el = useRef<HTMLDivElement | null>(null)
  const acc = useRef({ frames: 0, t: 0 })

  useEffect(() => {
    const div = document.createElement('div')
    div.style.cssText =
      'position:fixed;top:8px;left:8px;z-index:9999;font:11px/1.4 ui-monospace,monospace;' +
      'background:rgba(0,0,0,.65);color:#9f9;padding:6px 8px;border-radius:4px;pointer-events:none'
    div.textContent = '… (WebGPU HUD)'
    document.body.appendChild(div)
    el.current = div
    return () => div.remove()
  }, [])

  useFrame((_, delta) => {
    const a = acc.current
    a.frames += 1
    a.t += delta
    if (a.t >= 0.5 && el.current) {
      // WebGPURenderer resets render stats at frame end and useFrame runs pre-render,
      // so calls/triangles often read 0 here — show them only when they carry signal.
      const r = gl.info?.render
      const calls = r?.drawCalls ?? r?.calls ?? 0
      const detail = calls > 0 ? ` · calls ${calls} · tris ${r?.triangles ?? 0}` : ''
      el.current.textContent = `${Math.round(a.frames / a.t)} fps${detail} · WebGPU`
      a.frames = 0
      a.t = 0
    }
  })

  return null
}

/** Mount once inside the Canvas. Renders nothing in production. */
export function DevPerf() {
  const gl = useThree((s) => s.gl) as unknown as RendererInfoLike
  if (!import.meta.env.DEV || !Perf) return null
  if (gl.backend?.isWebGPUBackend) return <WebGpuHud />
  return (
    <Suspense fallback={null}>
      <Perf position="top-left" />
    </Suspense>
  )
}
