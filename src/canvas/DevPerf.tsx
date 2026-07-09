import { lazy, Suspense } from 'react'

// Dev-only performance HUD (draw calls, triangles, GPU/CPU frame time, memory) — the tool
// that makes the perf-fallback-auditor's budgets measurable instead of theoretical.
// r3f-perf is a devDependency: `import.meta.env.DEV` is statically false in production
// builds, so the whole lazy() branch below is dead code and Rollup drops the chunk.
const Perf = import.meta.env.DEV
  ? lazy(() => import('r3f-perf').then((m) => ({ default: m.Perf })))
  : null

/** Mount once inside the Canvas. Renders nothing in production. */
export function DevPerf() {
  if (!Perf) return null
  return (
    <Suspense fallback={null}>
      <Perf position="top-left" />
    </Suspense>
  )
}
