import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { FloatUniform } from '../city/shaders/trafficMaterial'
import type { QualityTier } from '../hooks/useQualityTier'

/**
 * useTrafficSpeed — the motion engineer's single owner of uSpeedScale.
 *
 * Design (ARCHITECTURE.md):
 *  - uSpeedScale is a material-local TSL uniform returned by makeTrafficMaterial (shader engineer).
 *    It multiplies aSpeed in the lane formula, acting as a global traffic pace multiplier.
 *  - This hook is the ONLY writer of that uniform. It applies a per-tier default on mount/tier
 *    change, and exposes setTrafficSpeed() for the UI agent's future speed slider.
 *  - setTrafficSpeed uses a GSAP one-shot tween (nothing else drives the uniform per frame, so
 *    GSAP is allowed). It tweens a plain proxy object and copies the value into the uniform each
 *    step, so the tween never co-drives a useFrame-owned value.
 *
 * Per-tier defaults:
 *  - low  (mobile/touch): 0.65 — reduce frantic motion on small screens; easier on the GPU.
 *  - medium:              0.85 — moderate pace.
 *  - high  (desktop GPU): 1.0  — full speed as authored by the shader engineer.
 *
 * API for the UI agent:
 *   const { setTrafficSpeed } = useTrafficSpeed(tier, speedScaleRef)
 *   setTrafficSpeed(1.5)   → smooth tween to 1.5x speed over 0.8s
 *   setTrafficSpeed(0)     → smooth tween to stop (e.g. pause traffic)
 *   setTrafficSpeed(1, 0)  → immediate reset (duration=0)
 */

const TIER_DEFAULT: Record<QualityTier, number> = {
  low: 0.65,
  medium: 0.85,
  high: 1.0,
}

export interface TrafficSpeedApi {
  /**
   * Tween uSpeedScale to `multiplier` over `duration` seconds (default 0.8s).
   * Uses GSAP ease 'power2.inOut'. Safe to call before the uniform is mounted
   * (it queues the final value and applies on next valid call).
   */
  setTrafficSpeed(multiplier: number, duration?: number): void
}

/**
 * @param tier   Current quality tier. Applied as the default speed when the uniform becomes
 *               available or when the tier changes.
 * @param uniformRef  Ref that Traffic.tsx populates with the uSpeedScale uniform after the
 *                    material is created. This hook becomes the owner once it has a reference.
 */
export function useTrafficSpeed(
  tier: QualityTier,
  uniformRef: React.MutableRefObject<FloatUniform | null>,
): TrafficSpeedApi {
  const tweenProxy = useRef({ value: TIER_DEFAULT[tier] })
  const activeTween = useRef<gsap.core.Tween | null>(null)
  // Pending multiplier requested before the uniform was ready.
  const pendingValue = useRef<number | null>(null)

  // Apply per-tier default when tier changes (or on first mount).
  useEffect(() => {
    const def = TIER_DEFAULT[tier]
    if (uniformRef.current) {
      uniformRef.current.value = def
      tweenProxy.current.value = def
    } else {
      // Store as pending; Traffic.tsx will call a setter when the uniform is ready.
      pendingValue.current = def
    }
  }, [tier, uniformRef])

  const api = useRef<TrafficSpeedApi>({
    setTrafficSpeed(multiplier: number, duration = 0.8) {
      // Kill any existing tween so we don't fight ourselves.
      activeTween.current?.kill()

      const uniform = uniformRef.current
      if (!uniform) {
        // Not mounted yet; store the desired value for when it becomes available.
        pendingValue.current = multiplier
        return
      }

      if (duration === 0) {
        uniform.value = multiplier
        tweenProxy.current.value = multiplier
        return
      }

      tweenProxy.current.value = uniform.value
      activeTween.current = gsap.to(tweenProxy.current, {
        value: multiplier,
        duration,
        ease: 'power2.inOut',
        onUpdate() {
          if (uniformRef.current) {
            uniformRef.current.value = tweenProxy.current.value
          }
        },
        onComplete() {
          activeTween.current = null
        },
      })
    },
  })

  // Flush any pending value once the uniformRef becomes populated.
  // We do this via a polling effect that runs every render. Since Traffic mounts once and
  // the uniform is set synchronously in useLayoutEffect, one extra render pass is enough.
  useEffect(() => {
    if (uniformRef.current && pendingValue.current !== null) {
      const val = pendingValue.current
      pendingValue.current = null
      uniformRef.current.value = val
      tweenProxy.current.value = val
    }
  })

  return api.current
}
