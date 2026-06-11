import { useEffect, useRef, useState } from 'react'
import type { QualityTier } from '../hooks/useQualityTier'
import { useSimClock } from '../sim/SimClock'

/**
 * DOM control panel — CONTRACT + minimal working implementation.
 *
 * [ui-overlay-a11y-engineer] OWNS the final design. This is a functional, accessible stub that
 * proves the contract: every control here maps to a SimClockApi call or the quality-override
 * setter. Keep the wiring (what each control reads/writes); restyle and enrich freely.
 *
 * Contract (props):
 *   qualityOverride / onQualityOverride  — null = "auto" (use detected tier). Selecting a tier
 *     forces it. Changing it remounts the Scene (handled in App via key), since grid/car counts
 *     are baked at generation time.
 *
 * Contract (sim, via useSimClock()):
 *   togglePaused() / setPaused()   — play/pause button
 *   setSpeed(x)                    — speed control (multiplier)
 *   setDayPhase(0..1)              — time-of-day slider (scrub); re-bases sim time
 *   setSecondsPerDay(s)            — (optional) day-length control
 *   get()                          — snapshot for rendering current values
 *
 * IMPORTANT (no extra RAF): this panel must NOT start a requestAnimationFrame to track time —
 * that would violate the single-loop rule. To display the auto-advancing clock it polls a
 * snapshot at a low fixed rate (see POLL_MS) only while not being dragged. The simulation itself
 * is driven solely by SimClockDriver's useFrame.
 *
 * No browser storage: the override and transient UI state live in React state only.
 */

const POLL_MS = 250 // ~4 Hz readout of the live clock; this is a UI label refresh, not an animation

interface Props {
  qualityOverride: QualityTier | null
  onQualityOverride: (tier: QualityTier | null) => void
  reduced: boolean
}

function phaseToClock(phase: number): string {
  const totalMin = Math.round(phase * 24 * 60) % (24 * 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const SPEEDS = [0.5, 1, 2, 5, 10] as const

export function ControlPanel({ qualityOverride, onQualityOverride, reduced }: Props) {
  const clock = useSimClock()
  const draggingTime = useRef(false)

  // Mirror just enough sim state into React state to render the controls. Updated by:
  //  - user input (immediate), and
  //  - a low-rate poll so the auto-advancing time-of-day label/slider stays roughly in sync.
  const [paused, setPaused] = useState(() => clock.get().paused)
  const [speed, setSpeed] = useState(() => clock.get().speed)
  const [phase, setPhase] = useState(() => clock.get().dayPhase)

  useEffect(() => {
    const id = window.setInterval(() => {
      if (draggingTime.current) return
      const s = clock.get()
      setPaused(s.paused)
      setSpeed(s.speed)
      setPhase(s.dayPhase)
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [clock])

  return (
    <aside className="panel" aria-label="Simulation controls">
      <h1 className="panel__title">Live City</h1>

      <div className="panel__row">
        <button
          type="button"
          className="panel__btn"
          aria-pressed={!paused}
          onClick={() => {
            clock.togglePaused()
            setPaused(clock.get().paused)
          }}
        >
          {paused ? 'Play' : 'Pause'}
        </button>
        <span className="panel__clock" aria-live="off">
          {phaseToClock(phase)}
        </span>
      </div>

      <label className="panel__field">
        <span>Time of day</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={phase}
          onPointerDown={() => (draggingTime.current = true)}
          onPointerUp={() => (draggingTime.current = false)}
          onChange={(e) => {
            const p = Number(e.target.value)
            setPhase(p)
            clock.setDayPhase(p)
          }}
        />
      </label>

      <fieldset className="panel__field">
        <legend>Speed</legend>
        <div className="panel__chips" role="group" aria-label="Simulation speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              className="panel__chip"
              aria-pressed={speed === s}
              onClick={() => {
                clock.setSpeed(s)
                setSpeed(s)
              }}
            >
              {s}x
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="panel__field">
        <legend>Quality</legend>
        <div className="panel__chips" role="group" aria-label="Quality tier override">
          {(['auto', 'low', 'medium', 'high'] as const).map((q) => {
            const value = q === 'auto' ? null : q
            const active = qualityOverride === value
            return (
              <button
                key={q}
                type="button"
                className="panel__chip"
                aria-pressed={active}
                onClick={() => onQualityOverride(value)}
              >
                {q}
              </button>
            )
          })}
        </div>
      </fieldset>

      {reduced && (
        <p className="panel__note">
          Reduced motion is on: the day/night cycle is paused. Use the time slider to move through
          the day manually.
        </p>
      )}

      {/* [ui agent] add: traffic density slider. Contract: expose a setter that the App passes to
          Scene -> Traffic to rebuild car instances at a new count (remount via key like quality). */}
    </aside>
  )
}
