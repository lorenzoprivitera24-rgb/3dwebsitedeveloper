import { useMemo } from 'react'

export type QualityTier = 'low' | 'medium' | 'high'

/**
 * Everything the scene needs to scale with device capability lives here, so there is
 * exactly one place that decides "how big is the city" and "how heavy is the frame".
 *
 * Read by: city layout generator (gridSize), Traffic (carCount), the sun/shadow setup
 * (shadows, shadowMapSize), the Canvas (dpr), and building geometry (buildingSegments).
 */
export interface TierSettings {
  tier: QualityTier
  /** City is a gridSize x gridSize array of blocks. Total buildings scale ~ gridSize^2. */
  gridSize: number
  /** Total cars distributed across all lanes. */
  carCount: number
  /** Whether the directional sun casts real shadows (the single shadow caster). */
  shadows: boolean
  /** Shadow map resolution for the sun, when shadows are on. */
  shadowMapSize: number
  /** Box segment count for building archetypes (facade detail headroom for the shader engineer). */
  buildingSegments: number
  /** Device pixel ratio clamp for the Canvas. Never uncapped; hard ceiling of 2. */
  dpr: [number, number]
}

const TIERS: Record<QualityTier, TierSettings> = {
  // Touch / small / low-memory. Keep draw + fragment work modest, no shadow pass.
  low: {
    tier: 'low',
    gridSize: 6,
    carCount: 60,
    shadows: false,
    shadowMapSize: 1024,
    buildingSegments: 1,
    dpr: [1, 1.5],
  },
  // Mid desktop / large tablet. Shadows on at a moderate map size.
  medium: {
    tier: 'medium',
    gridSize: 9,
    carCount: 160,
    shadows: true,
    shadowMapSize: 2048,
    buildingSegments: 1,
    dpr: [1, 2],
  },
  // Desktop with a real GPU. Bigger city, crisper shadows.
  high: {
    tier: 'high',
    gridSize: 12,
    carCount: 320,
    shadows: true,
    // 2048 is already crisp over the ~700m shadow frustum (~1.5 px/m); 4096 would cost a 64 MB
    // depth texture and risks allocation spikes on integrated GPUs that still land in this tier.
    shadowMapSize: 2048,
    buildingSegments: 2,
    dpr: [1, 2],
  },
}

/**
 * Picks a tier from viewport width, pointer coarseness (touch) and device memory.
 * Computed once on mount. A `quality override` from the control panel (see ARCHITECTURE.md)
 * supersedes this; the override is plumbed at the App level, not inside this hook.
 */
export function pickTier(): QualityTier {
  if (typeof window === 'undefined') return 'medium'
  const w = window.innerWidth
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  const coarse = window.matchMedia('(pointer: coarse)').matches
  if (coarse || w < 768 || mem <= 2) return 'low'
  if (w < 1280 || mem <= 4) return 'medium'
  return 'high'
}

export function tierSettings(tier: QualityTier): TierSettings {
  return TIERS[tier]
}

export function useQualityTier(override?: QualityTier): TierSettings {
  return useMemo(() => tierSettings(override ?? pickTier()), [override])
}
