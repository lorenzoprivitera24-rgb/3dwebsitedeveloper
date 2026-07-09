import { useEffect, useState } from 'react'

export type QualityTier = 'low' | 'medium' | 'high'
export type PostLevel = 'off' | 'medium' | 'full'

export interface TierSettings {
  tier: QualityTier
  detail: number // geometry subdivision for the hero form
  amplitude: number // max displacement amplitude
  dpr: [number, number] // device pixel ratio range for the Canvas
  postLevel: PostLevel // post-FX chain: full / medium (no bloom/DoF) / off
  particleCount: number // budget for any particle system
  physicsEnabled: boolean // rapier & friends only from medium up
  windOctaves: number // layers of the TSL wind (1 = global sway only)
  shadowMapSize: number // resolution of the single shadow-casting light
}

const PRESETS: Record<QualityTier, TierSettings> = {
  low: {
    tier: 'low', detail: 48, amplitude: 0.35, dpr: [1, 1.5],
    postLevel: 'off', particleCount: 400, physicsEnabled: false, windOctaves: 1, shadowMapSize: 512,
  },
  medium: {
    tier: 'medium', detail: 96, amplitude: 0.45, dpr: [1, 2],
    postLevel: 'medium', particleCount: 1500, physicsEnabled: true, windOctaves: 2, shadowMapSize: 1024,
  },
  high: {
    tier: 'high', detail: 128, amplitude: 0.55, dpr: [1, 2],
    postLevel: 'full', particleCount: 4000, physicsEnabled: true, windOctaves: 3, shadowMapSize: 2048,
  },
}

// Static tier, chosen from signals available at load. Rules of the rewrite (ROADMAP NOW):
// - deviceMemory is UNDEFINED on Safari/iOS — its absence must never downgrade the tier;
//   only an explicit low value counts against the device.
// - A coarse pointer alone is not "low": modern phones handle the medium tier. Low is
//   small-viewport touch, explicit low memory, or very few cores.
// The RUNTIME adaptive layer (drei <PerformanceMonitor> + <AdaptiveDpr>) is a separate,
// planned step — this hook only picks the starting point.
function computeTier(): QualityTier {
  if (typeof window === 'undefined') return 'medium'
  const w = window.innerWidth
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const cores = navigator.hardwareConcurrency ?? 4
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory

  if ((mem !== undefined && mem <= 2) || (coarse && w < 480) || cores <= 2) return 'low'
  if (coarse || w < 1024 || (mem !== undefined && mem <= 4) || cores <= 4) return 'medium'
  return 'high'
}

// Recomputed on debounced resize/orientation change (was: useMemo([]), frozen at mount —
// wrong after rotate or window moves between screens).
export function useQualityTier(): TierSettings {
  const [tier, setTier] = useState<QualityTier>(computeTier)

  useEffect(() => {
    let timer: number | undefined
    const recompute = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setTier(computeTier()), 250)
    }
    window.addEventListener('resize', recompute)
    window.addEventListener('orientationchange', recompute)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', recompute)
      window.removeEventListener('orientationchange', recompute)
    }
  }, [])

  return PRESETS[tier]
}
