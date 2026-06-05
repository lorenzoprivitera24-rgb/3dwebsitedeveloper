import { useMemo } from 'react'

export type QualityTier = 'low' | 'medium' | 'high'

export interface TierSettings {
  tier: QualityTier
  detail: number // geometry subdivision for the icosahedron
  amplitude: number // max displacement amplitude
  dpr: [number, number] // device pixel ratio range for the Canvas
}

// Picks a quality tier from viewport, pointer coarseness (touch), and device memory.
// Computed once on mount; for a production app you may want to recompute on resize/orientation.
export function useQualityTier(): TierSettings {
  return useMemo(() => {
    if (typeof window === 'undefined') {
      return { tier: 'medium', detail: 96, amplitude: 0.45, dpr: [1, 2] }
    }
    const w = window.innerWidth
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
    const coarse = window.matchMedia('(pointer: coarse)').matches

    let tier: QualityTier = 'high'
    if (coarse || w < 768 || mem <= 2) tier = 'low'
    else if (w < 1280 || mem <= 4) tier = 'medium'

    const byTier: Record<QualityTier, TierSettings> = {
      low: { tier: 'low', detail: 48, amplitude: 0.35, dpr: [1, 1.5] },
      medium: { tier: 'medium', detail: 96, amplitude: 0.45, dpr: [1, 2] },
      high: { tier: 'high', detail: 128, amplitude: 0.55, dpr: [1, 2] },
    }
    return byTier[tier]
  }, [])
}
