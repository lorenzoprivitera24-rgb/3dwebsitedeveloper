import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { ACESFilmicToneMapping, PCFSoftShadowMap } from 'three'

/**
 * Renderer-level setup that the declarative <Canvas> props do not cover cleanly: ACES tone
 * mapping (the realistic-look requirement), soft shadow maps, and enabling the shadow pass.
 *
 * Applied imperatively once because these are renderer flags, not scene objects. Tone-mapping
 * EXPOSURE can later be animated with the day/night cycle by the shader/motion engineer (read
 * simUniforms.uDaylight), but that would make exposure a per-frame-owned value — if so, this is
 * the single place that writes renderer.toneMappingExposure. For now it is a constant.
 *
 * [shader engineer] extension point: switch to a TSL post pipeline (bloom for night window glow)
 * here, gated by renderer.isWebGPURenderer where a WebGPU-only pass is used.
 */
export function RendererConfig({ shadows }: { shadows: boolean }) {
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    gl.toneMapping = ACESFilmicToneMapping
    gl.toneMappingExposure = 1.0
    // shadow map config (the sun is the single shadow caster, set up in SimClockDriver).
    gl.shadowMap.enabled = shadows
    gl.shadowMap.type = PCFSoftShadowMap
  }, [gl, shadows])

  return null
}
