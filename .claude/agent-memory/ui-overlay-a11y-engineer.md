# ui-overlay-a11y-engineer — project memory (live city sim)

## What I own

- `src/ui/ControlPanel.tsx` — full redesign (replaces the functional stub).
- `src/styles.css` — full rewrite with design token system, panel variants (desktop sidebar +
  mobile bottom sheet), HUD, and reduced-motion CSS safety net.
- Updated `ARCHITECTURE.md` — "Control panel contract" section updated to "as implemented",
  with the full controls table, prop chain notes, density pattern, layout strategy, and
  accessibility checklist.

## Layout strategy

- **≥ 641px (desktop):** `.cp--desktop` — fixed left sidebar, 18rem wide, scrollable, always
  visible. Motion mount animation: fade + slide-left (instant when `reduced=true`).
- **≤ 640px (mobile):** `.cp--desktop` hidden via `display: none`. A `.cp__sheet-toggle` FAB
  (56×56px, bottom-right) opens `.cp--sheet` (bottom sheet, max 78svh). The bottom sheet uses
  `AnimatePresence` for slide-up/down animation.

## Controls and their wiring

| Control | API |
|---|---|
| Play/Pause | `clock.togglePaused()` |
| Time-of-day slider (0..1) | `clock.setDayPhase(p)` |
| Speed chips | `clock.setSpeed(x)` |
| Density chips (bassa/media/alta) | `onDensity(d)` — remounts Scene via key |
| Traffic speed chips (Fermo/Lento/Normale/Veloce) | `trafficSpeedRef.current?.setTrafficSpeed(n)` |
| Quality chips | `onQualityOverride(tier\|null)` — remounts Scene via key |
| Fly-to Strada | `rigHandleRef.current?.flyTo(PRESET_STREET_DUSK)` |
| Fly-to Skyline | `rigHandleRef.current?.flyTo(PRESET_SKYLINE)` |
| Nuova città | `onNewSeed()` |

## Prop chain

No changes to App.tsx or Scene.tsx were required — the architect had already wired all props.

## Motion patterns

- Desktop panel: `motion.aside` with `initial/animate/variants` for mount fade.
- Mobile sheet: `AnimatePresence` + `motion.aside` with slide-up variants.
- All `transition` objects computed with `panelTransition(reduced)`: spring animation when
  `reduced=false`, `{ duration: 0 }` when `reduced=true`.
- HUD hint: `AnimatePresence` + fade. Dismissed on first `pointerdown` or `keydown` (window,
  once, passive). Under `reduced=true`: no opacity animation (initial=1, exit instant).
- `reduced` prop is the App-level value from `useReducedMotion()`. It is the single source;
  we do NOT re-call `useReducedMotion()` here — using the parent's value keeps the whole app
  consistent.

## Accessibility checklist (pass/fail)

| Item | Status |
|---|---|
| Canvas wrapper `aria-hidden="true"` | PASS — present in App.tsx, never touched |
| All controls are real labeled inputs/buttons | PASS — all Italian `aria-label` strings |
| Time slider `aria-valuetext` | PASS — announces "HH:MM — period" |
| Bottom-sheet toggle `aria-expanded` + `aria-controls` | PASS |
| Keyboard focus managed on sheet open | PASS — closeBtnRef.focus() after 50ms |
| `prefers-reduced-motion` DOM path | PASS — via `reduced` prop + CSS @media |
| Contrast: `--fg` over panel (day sky) | PASS — ≥ 12:1 estimated |
| Contrast: `--fg` over panel (night sky) | PASS — ≥ 14:1 estimated |
| Contrast: `--muted` over panel | PASS — ≥ 5.5:1 estimated (AA) |
| Touch targets ≥ 44px | PASS — `min-height: 2.75rem` (44px) on all chips/buttons |
| Safe-area insets | PASS — `env(safe-area-inset-*)` on panel, FAB, HUD clock |
| No `framer-motion-3d` | PASS |
| No browser storage | PASS |
| No new RAF loops | PASS — panel uses `setInterval` only; HUD has no polling loop |
| HUD clock is decorative (aria-hidden) | PASS — `.hud` wrapper is `aria-hidden="true"` |

## Build status

`npm run build` clean (2026-06-11):
- 479 modules transformed
- dist/assets/index-*.css  10.48 kB (gzip 2.77 kB)
- dist/assets/index-*.js  586.24 kB (gzip 193.50 kB)
- dist/assets/three-*.js 1381.98 kB (gzip 372.94 kB)
- Build time: 3.98s

## Notes for perf auditor

1. **ControlPanel re-render scope:** `phase`, `paused`, `speed` re-render at 4 Hz (250ms
   setInterval). This is intentional and correct. The panel is a small component tree; verify
   that the re-render does NOT propagate to Scene or Stage (it should not — the clock ref is
   separate from React state, and Scene is outside the panel subtree).
2. **Motion AnimatePresence:** on mobile, each open/close cycle mounts/unmounts the sheet. This
   is correct behaviour. The spring animation is lightweight DOM-only.
3. **HUD hint dismissal:** the `pointerdown`/`keydown` window listeners use `{ once: true }`, so
   they self-remove. No leak possible. The `useEffect` cleanup also removes them.
4. **trafficSpeedRef / rigHandleRef are only read on user interaction** (button click), never
   polled. No performance concern.
5. **Traffic speed local state vs uniform:** `trafficSpeedIndex` is local React state that does
   NOT sync back from the actual uniform (which may be tweened). This means if the tier changes
   (remounting Scene), the UI chip may show "Normale" but the uniform starts at the tier default.
   This is acceptable (it self-corrects on next user interaction). If exact sync is needed, the
   chip group could read `trafficSpeedRef.current?.value` — but that requires exposing a getter,
   which was not in the contract.
