import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react'

/**
 * The simulation clock.
 *
 * Design rule (adapted CLAUDE.md rule 3 — see ARCHITECTURE.md): the clock state lives in a
 * single MUTABLE REF, never React state, so advancing it never re-renders. It is advanced by
 * exactly one `useFrame` (the SimClockDriver, inside the Canvas). The DOM control panel and the
 * scene read/write it through the imperative `SimClockApi` exposed on context — also without
 * triggering React renders. This keeps "one per-frame owner" intact: the driver owns time, the
 * panel only issues commands (pause, setSpeed, scrub).
 */

export interface SimClockState {
  /** Accumulated in-sim seconds since start (wall seconds * speed, while not paused). */
  simSeconds: number
  /** Time of day normalized to 0..1. 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset. */
  dayPhase: number
  /** Whether the clock is advancing. */
  paused: boolean
  /** Sim speed multiplier (1 = real time relative to secondsPerDay). */
  speed: number
  /** Wall-clock seconds that make up one full in-sim day. Default ~120s (2 real minutes). */
  secondsPerDay: number
}

/**
 * Imperative API the UI panel calls. No method returns per-frame data; the panel reads the
 * current snapshot via `get()` on demand (e.g. to render the slider position once), and writes
 * via the setters. The scene reads the live ref directly each frame.
 */
export interface SimClockApi {
  /** Live, mutable state. The driver mutates this each frame; readers should treat it as read-mostly. */
  readonly ref: { current: SimClockState }
  /** Snapshot copy for UI rendering (so the panel never holds a live mutable reference). */
  get(): SimClockState
  setPaused(paused: boolean): void
  togglePaused(): void
  setSpeed(speed: number): void
  /** Jump the time of day directly (slider scrub). Updates dayPhase and re-bases simSeconds. */
  setDayPhase(phase: number): void
  setSecondsPerDay(seconds: number): void
}

const DEFAULT_SECONDS_PER_DAY = 120 // ~2 real minutes per in-sim day
const DEFAULT_START_PHASE = 0.35 // start mid-morning so the city reads immediately

function makeInitialState(): SimClockState {
  return {
    simSeconds: DEFAULT_START_PHASE * DEFAULT_SECONDS_PER_DAY,
    dayPhase: DEFAULT_START_PHASE,
    paused: false,
    speed: 1,
    secondsPerDay: DEFAULT_SECONDS_PER_DAY,
  }
}

const SimClockContext = createContext<SimClockApi | null>(null)

export function SimClockProvider({ children }: { children: ReactNode }) {
  const ref = useRef<SimClockState>(makeInitialState())

  const api = useMemo<SimClockApi>(() => {
    const wrap = (n: number) => ((n % 1) + 1) % 1 // keep dayPhase in 0..1
    return {
      ref,
      get: () => ({ ...ref.current }),
      setPaused: (paused) => {
        ref.current.paused = paused
      },
      togglePaused: () => {
        ref.current.paused = !ref.current.paused
      },
      setSpeed: (speed) => {
        ref.current.speed = Math.max(0, speed)
      },
      setDayPhase: (phase) => {
        const p = wrap(phase)
        ref.current.dayPhase = p
        // re-base simSeconds so the next advance continues smoothly from the scrubbed time
        ref.current.simSeconds = p * ref.current.secondsPerDay
      },
      setSecondsPerDay: (seconds) => {
        ref.current.secondsPerDay = Math.max(1, seconds)
      },
    }
  }, [])

  return <SimClockContext.Provider value={api}>{children}</SimClockContext.Provider>
}

export function useSimClock(): SimClockApi {
  const api = useContext(SimClockContext)
  if (!api) throw new Error('useSimClock must be used inside <SimClockProvider>')
  return api
}

/**
 * Advance the clock. Called from a single useFrame (SimClockDriver). When `frozen` is true
 * (reduced-motion), the clock holds its current dayPhase: time of day does not auto-advance,
 * but the panel can still scrub manually. Pure function of (state, dt) for testability.
 */
export function advanceClock(state: SimClockState, dtSeconds: number, frozen: boolean): void {
  if (state.paused || frozen || state.speed === 0) return
  state.simSeconds += dtSeconds * state.speed
  const phase = (state.simSeconds / state.secondsPerDay) % 1
  state.dayPhase = phase < 0 ? phase + 1 : phase
}
