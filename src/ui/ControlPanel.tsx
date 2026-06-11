import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CameraRigHandle } from '../camera/CameraRig'
import { PRESET_SKYLINE, PRESET_STREET_DUSK } from '../camera/CameraRig'
import type { QualityTier } from '../hooks/useQualityTier'
import type { TrafficSpeedApi } from '../motion/useTrafficSpeed'
import { useSimClock } from '../sim/SimClock'
import type { TrafficDensity } from '../App'

/**
 * DOM control panel — fully redesigned (ui-overlay-a11y-engineer, 2026-06-11).
 *
 * Layout strategy:
 *  - Desktop (≥ 641px): fixed left-side panel, always visible.
 *  - Mobile (≤ 640px): collapsible bottom sheet; a floating toggle button opens/closes it.
 *
 * Motion (motion/react, DOM only):
 *  - Panel open/close animated via AnimatePresence + motion.div (slide + fade).
 *  - Under prefers-reduced-motion (reduced === true): all Motion transitions are instant
 *    (duration 0). The `reduced` prop flows from App → this component; we honour it directly
 *    rather than re-reading the media query so the value is consistent across the whole app.
 *
 * Accessibility:
 *  - Every control is a real labeled HTML element.
 *  - Labels and copy in Italian (lang="it" is set on <html> in index.html).
 *  - Range inputs carry aria-valuetext announcing human-readable values.
 *  - Toggle button has aria-expanded and aria-controls.
 *  - Focus is managed on sheet open (auto-focus the close button).
 *  - No information conveyed by colour alone.
 *  - Panel background is opaque-enough to pass 4.5:1 against both the bright day sky (#9bb8d8)
 *    and the dark night sky (#070b18).
 *
 * No browser storage. No new RAF loops. No framer-motion-3d.
 */

// ── Clock label refresh (UI only, ~4 Hz) — NOT a RAF loop ─────────────────────────────────────
const POLL_MS = 250

// ── Helpers ────────────────────────────────────────────────────────────────────────────────────

/** Convert 0..1 dayPhase → "HH:MM" string (Italian 24h). */
function phaseToClock(phase: number): string {
  const totalMin = Math.round(phase * 24 * 60) % (24 * 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Convert 0..1 dayPhase → aria-valuetext ("18:30 — tramonto"). */
function phaseToAriaText(phase: number): string {
  const clock = phaseToClock(phase)
  // Rough time-of-day descriptions for Italian screen readers.
  let label: string
  if (phase < 0.15 || phase >= 0.92) label = 'notte profonda'
  else if (phase < 0.22) label = 'alba'
  else if (phase < 0.3) label = 'alba'
  else if (phase < 0.45) label = 'mattina'
  else if (phase < 0.55) label = 'mezzogiorno'
  else if (phase < 0.65) label = 'pomeriggio'
  else if (phase < 0.78) label = 'sera'
  else if (phase < 0.85) label = 'tramonto'
  else label = 'notte'
  return `${clock} — ${label}`
}

// Simulation speed chips
const SPEEDS = [0.5, 1, 2, 5, 10] as const

const QUALITY_LABELS: Record<'auto' | QualityTier, string> = {
  auto: 'Auto',
  low: 'Bassa',
  medium: 'Media',
  high: 'Alta',
}

const DENSITY_LABELS: Record<TrafficDensity, string> = {
  bassa: 'Scarso',
  media: 'Normale',
  alta: 'Intenso',
}

/**
 * Vehicle speed presets. The SELECTION lives in App (not here) so it survives the key-based
 * Scene remounts (quality/density/seed changes), which reset the uniform to the tier default:
 * App re-applies the user's selection when the fresh Scene registers its TrafficSpeedApi.
 * `null` selection = tier default pace, no chip pressed.
 */
export const TRAFFIC_SPEED_PRESETS = [
  { value: 0, label: 'Fermo' },
  { value: 0.65, label: 'Lento' },
  { value: 1, label: 'Normale' },
  { value: 1.5, label: 'Veloce' },
] as const

// ── Motion transition helpers ──────────────────────────────────────────────────────────────────

/** Build a Motion transition config. When reduced=true, collapse to instant. */
function panelTransition(reduced: boolean) {
  return reduced
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 340, damping: 32, mass: 0.9 }
}

/** Slide-up + fade for the bottom sheet (mobile). */
function sheetVariants(reduced: boolean) {
  return {
    hidden: { opacity: reduced ? 1 : 0, y: reduced ? 0 : '100%' },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: reduced ? 1 : 0, y: reduced ? 0 : '100%' },
  }
}

/** Fade for the panel on desktop (already always visible; used for mount animation only). */
function desktopPanelVariants(reduced: boolean) {
  return {
    hidden: { opacity: reduced ? 1 : 0, x: reduced ? 0 : -16 },
    visible: { opacity: 1, x: 0 },
  }
}

// ── Props ──────────────────────────────────────────────────────────────────────────────────────

export interface ControlPanelProps {
  qualityOverride: QualityTier | null
  onQualityOverride: (tier: QualityTier | null) => void
  reduced: boolean
  density: TrafficDensity
  onDensity: (d: TrafficDensity) => void
  /** Ref forwarded from Scene via App. May be null until the rig mounts. */
  rigHandleRef: React.MutableRefObject<CameraRigHandle | null>
  /** Ref forwarded from Scene via App. May be null until Traffic mounts. */
  trafficSpeedRef: React.MutableRefObject<TrafficSpeedApi | null>
  /** Selected vehicle-speed preset index; null = tier default (no chip pressed). Lives in App. */
  trafficSpeedIndex: number | null
  onTrafficSpeedIndex: (idx: number) => void
  onNewSeed: () => void
}

// ── Main component ─────────────────────────────────────────────────────────────────────────────

export function ControlPanel({
  qualityOverride,
  onQualityOverride,
  reduced,
  density,
  onDensity,
  rigHandleRef,
  trafficSpeedRef,
  trafficSpeedIndex,
  onTrafficSpeedIndex,
  onNewSeed,
}: ControlPanelProps) {
  const clock = useSimClock()
  const draggingTime = useRef(false)

  // ── Sim state mirrored into React (for controls only, not per-frame) ────────────────────────
  const [paused, setPaused] = useState(() => clock.get().paused)
  const [speed, setSpeed] = useState(() => clock.get().speed)
  const [phase, setPhase] = useState(() => clock.get().dayPhase)

  // ── Bottom-sheet open/close state (mobile only) ─────────────────────────────────────────────
  const [sheetOpen, setSheetOpen] = useState(false)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  // ── ~4 Hz clock poll (label refresh; NOT a RAF) ─────────────────────────────────────────────
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

  // Focus the close button when the sheet opens (keyboard management)
  useEffect(() => {
    if (sheetOpen) {
      // defer to let the animation start before stealing focus
      const id = setTimeout(() => closeBtnRef.current?.focus(), 50)
      return () => clearTimeout(id)
    }
  }, [sheetOpen])

  // ── Handlers ───────────────────────────────────────────────────────────────────────────────

  const handleTogglePause = useCallback(() => {
    clock.togglePaused()
    setPaused(clock.get().paused)
  }, [clock])

  const handlePhaseChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const p = Number(e.target.value)
      setPhase(p)
      clock.setDayPhase(p)
    },
    [clock],
  )

  const handleSpeedClick = useCallback(
    (s: (typeof SPEEDS)[number]) => {
      clock.setSpeed(s)
      setSpeed(s)
    },
    [clock],
  )

  const handleFlyTo = useCallback(
    (preset: 'street' | 'skyline') => {
      const h = rigHandleRef.current
      if (!h) return
      h.flyTo(preset === 'street' ? PRESET_STREET_DUSK : PRESET_SKYLINE)
    },
    [rigHandleRef],
  )

  const handleTrafficSpeed = useCallback(
    (idx: number) => {
      onTrafficSpeedIndex(idx)
      trafficSpeedRef.current?.setTrafficSpeed(TRAFFIC_SPEED_PRESETS[idx].value)
    },
    [trafficSpeedRef, onTrafficSpeedIndex],
  )

  // ── The panel controls markup (shared between desktop sidebar and mobile sheet) ─────────────

  const clockLabel = phaseToClock(phase)
  const clockAriaText = phaseToAriaText(phase)

  const panelContent = (
    <div className="cp__inner">
      {/* ── Section: Tempo ──────────────────────────────────────────────────── */}
      <section className="cp__section" aria-labelledby="cp-tempo-heading">
        <h2 className="cp__section-heading" id="cp-tempo-heading">
          Tempo
        </h2>

        {/* Clock display + play/pause in a row */}
        <div className="cp__row cp__row--spaced">
          <button
            type="button"
            className="cp__btn cp__btn--primary"
            aria-label={paused ? 'Riprendi simulazione' : 'Metti in pausa simulazione'}
            aria-pressed={!paused}
            onClick={handleTogglePause}
          >
            <span aria-hidden="true">{paused ? '▶' : '⏸'}</span>
            <span className="cp__btn-label">{paused ? 'Riprendi' : 'Pausa'}</span>
          </button>

          <output
            className="cp__clock"
            htmlFor="cp-ora-del-giorno"
            aria-label={`Ora corrente: ${clockAriaText}`}
            aria-live="off"
          >
            {clockLabel}
          </output>
        </div>

        {/* Time-of-day scrubber — the signature control, made prominent */}
        <div className="cp__field">
          <label className="cp__label cp__label--prominent" htmlFor="cp-ora-del-giorno">
            Ora del giorno
          </label>
          <div className="cp__range-track">
            {/* Gradient track behind the range input for visual richness */}
            <div className="cp__range-bg" aria-hidden="true" />
            <input
              id="cp-ora-del-giorno"
              type="range"
              className="cp__range cp__range--prominent"
              min={0}
              max={1}
              step={0.001}
              value={phase}
              aria-valuemin={0}
              aria-valuemax={1}
              aria-valuenow={phase}
              aria-valuetext={clockAriaText}
              onPointerDown={() => (draggingTime.current = true)}
              onPointerUp={() => (draggingTime.current = false)}
              onChange={handlePhaseChange}
            />
          </div>
          <div className="cp__range-ticks" aria-hidden="true">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>24:00</span>
          </div>
        </div>

        {/* Speed chips */}
        <fieldset className="cp__fieldset">
          <legend className="cp__legend">Velocità simulazione</legend>
          <div className="cp__chips" role="group">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                className="cp__chip"
                aria-pressed={speed === s}
                aria-label={`Velocità ${s}×`}
                onClick={() => handleSpeedClick(s)}
              >
                {s}×
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      {/* ── Section: Traffico ───────────────────────────────────────────────── */}
      <section className="cp__section" aria-labelledby="cp-traffico-heading">
        <h2 className="cp__section-heading" id="cp-traffico-heading">
          Traffico
        </h2>

        {/* Traffic density */}
        <fieldset className="cp__fieldset">
          <legend className="cp__legend">Densità</legend>
          <div className="cp__chips" role="group">
            {(['bassa', 'media', 'alta'] as const).map((d) => (
              <button
                key={d}
                type="button"
                className="cp__chip"
                aria-pressed={density === d}
                aria-label={`Densità traffico: ${DENSITY_LABELS[d]}`}
                onClick={() => onDensity(d)}
              >
                {DENSITY_LABELS[d]}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Traffic speed */}
        <fieldset className="cp__fieldset">
          <legend className="cp__legend">Velocità veicoli</legend>
          <div className="cp__chips" role="group">
            {TRAFFIC_SPEED_PRESETS.map((p, idx) => (
              <button
                key={p.label}
                type="button"
                className="cp__chip"
                aria-pressed={trafficSpeedIndex === idx}
                aria-label={`Velocità veicoli: ${p.label}`}
                onClick={() => handleTrafficSpeed(idx)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      {/* ── Section: Vista ──────────────────────────────────────────────────── */}
      <section className="cp__section" aria-labelledby="cp-vista-heading">
        <h2 className="cp__section-heading" id="cp-vista-heading">
          Vista
        </h2>

        <div className="cp__row cp__row--gap">
          <button
            type="button"
            className="cp__btn cp__btn--secondary"
            aria-label="Vai alla vista strada al tramonto"
            onClick={() => handleFlyTo('street')}
          >
            🏙 Strada
          </button>
          <button
            type="button"
            className="cp__btn cp__btn--secondary"
            aria-label="Vai alla vista panoramica della città"
            onClick={() => handleFlyTo('skyline')}
          >
            🗺 Skyline
          </button>
        </div>

        {/* Quality override */}
        <fieldset className="cp__fieldset">
          <legend className="cp__legend">Qualità grafica</legend>
          <div className="cp__chips" role="group">
            {(['auto', 'low', 'medium', 'high'] as const).map((q) => {
              const value = q === 'auto' ? null : (q as QualityTier)
              const active = qualityOverride === value
              return (
                <button
                  key={q}
                  type="button"
                  className="cp__chip"
                  aria-pressed={active}
                  aria-label={`Qualità grafica: ${QUALITY_LABELS[q]}`}
                  onClick={() => onQualityOverride(value)}
                >
                  {QUALITY_LABELS[q]}
                </button>
              )
            })}
          </div>
        </fieldset>
      </section>

      {/* ── Section: Città ──────────────────────────────────────────────────── */}
      <section className="cp__section" aria-labelledby="cp-citta-heading">
        <h2 className="cp__section-heading" id="cp-citta-heading">
          Città
        </h2>
        <button
          type="button"
          className="cp__btn cp__btn--outline"
          aria-label="Genera una nuova città con seme casuale (rimonta la scena)"
          onClick={onNewSeed}
        >
          + Nuova città
        </button>
      </section>

      {/* Reduced-motion notice */}
      {reduced && (
        <p className="cp__note" role="note">
          Movimento ridotto attivo: il ciclo giorno/notte è congelato. Usa il cursore dell'ora per
          navigare manualmente nel giorno.
        </p>
      )}
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ══════════ DESKTOP SIDEBAR (≥ 641px, always visible) ══════════════════════════════════ */}
      <motion.aside
        className="cp cp--desktop"
        aria-label="Pannello di controllo simulazione"
        role="complementary"
        initial="hidden"
        animate="visible"
        variants={desktopPanelVariants(reduced)}
        transition={panelTransition(reduced)}
      >
        <header className="cp__header">
          <h1 className="cp__title">
            <span className="cp__title-main">Città Viva</span>
            <span className="cp__title-sub">Simulatore Urbano</span>
          </h1>
        </header>
        {panelContent}
      </motion.aside>

      {/* ══════════ MOBILE BOTTOM SHEET (≤ 640px) ══════════════════════════════════════════════ */}
      {/* Toggle button — always visible on mobile, outside the sheet */}
      <button
        type="button"
        className="cp__sheet-toggle"
        aria-label={sheetOpen ? 'Chiudi pannello di controllo' : 'Apri pannello di controllo'}
        aria-expanded={sheetOpen}
        aria-controls="cp-sheet"
        onClick={() => setSheetOpen((v) => !v)}
      >
        <span className="cp__sheet-toggle-icon" aria-hidden="true">
          {sheetOpen ? '✕' : '⚙'}
        </span>
      </button>

      <AnimatePresence>
        {sheetOpen && (
          <motion.aside
            id="cp-sheet"
            className="cp cp--sheet"
            aria-label="Pannello di controllo simulazione"
            role="complementary"
            key="sheet"
            variants={sheetVariants(reduced)}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={panelTransition(reduced)}
          >
            {/* Sheet drag handle + header */}
            <div className="cp__sheet-header">
              <div className="cp__sheet-handle" aria-hidden="true" />
              <div className="cp__row cp__row--spaced">
                <h1 className="cp__title cp__title--sheet">
                  <span className="cp__title-main">Città Viva</span>
                </h1>
                <button
                  ref={closeBtnRef}
                  type="button"
                  className="cp__sheet-close"
                  aria-label="Chiudi pannello di controllo"
                  onClick={() => setSheetOpen(false)}
                >
                  ✕
                </button>
              </div>
            </div>
            {panelContent}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ══════════ HUD (always visible, on top of canvas) ══════════════════════════════════════ */}
      <HUD phase={phase} reduced={reduced} />
    </>
  )
}

// ── HUD component ─────────────────────────────────────────────────────────────────────────────

/**
 * Heads-up display: app title (desktop hidden, redundant with panel), live clock, and a
 * camera-hints overlay that fades after the first pointer interaction.
 *
 * The hint fade is driven by Motion (DOM). No RAF, no timer-based fade.
 */
function HUD({ phase, reduced }: { phase: number; reduced: boolean }) {
  const [hintDismissed, setHintDismissed] = useState(false)

  // Dismiss the hint on first interaction (pointer or keyboard) anywhere on the canvas layer.
  // We listen on window so it catches all interactions, including those that land on the canvas
  // (which is aria-hidden and doesn't bubble to us via React events).
  useEffect(() => {
    if (hintDismissed) return
    const dismiss = () => setHintDismissed(true)
    window.addEventListener('pointerdown', dismiss, { once: true, passive: true })
    window.addEventListener('keydown', dismiss, { once: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('keydown', dismiss)
    }
  }, [hintDismissed])

  const fadeTransition = reduced
    ? { duration: 0 }
    : ({ duration: 0.6, ease: 'easeOut' } as const)

  return (
    <div className="hud" aria-hidden="true">
      {/* Live clock in top-right corner */}
      <div className="hud__clock" role="presentation">
        <span className="hud__clock-value">{phaseToClock(phase)}</span>
      </div>

      {/* Camera hint — fades after first interaction */}
      <AnimatePresence>
        {!hintDismissed && (
          <motion.div
            className="hud__hint"
            initial={{ opacity: reduced ? 1 : 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeTransition}
          >
            <span className="hud__hint-line">Trascina per orbitare</span>
            <span className="hud__hint-sep" aria-hidden="true">·</span>
            <span className="hud__hint-line">Pinch / rotella per zoom</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
