// Decides whether to mount the 3D canvas at all.
//
// We do NOT need to detect WebGPU here: three's WebGPURenderer.init() falls back to
// WebGL2 automatically when WebGPU is unavailable. So the only question is whether the
// device can create *any* WebGL context. If not, we show a static poster instead.

let cached: boolean | null = null

export function supportsWebGL(): boolean {
  if (cached !== null) return cached
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    cached = Boolean(gl)
  } catch {
    cached = false
  }
  return cached
}
