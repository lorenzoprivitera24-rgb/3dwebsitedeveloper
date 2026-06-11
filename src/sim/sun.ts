import { Vector3, Color } from 'three'

/**
 * Sun model: maps the sim clock's dayPhase (0..1) to a sun DIRECTION and a rough sky/sun
 * COLOR + INTENSITY. This is the single source for "where is the sun and how bright is it",
 * read by the lighting rig (architect) and exposed as the `uSunDirection` uniform to the
 * shader engineer (procedural sky / facade lighting / fog tint).
 *
 * Convention: `uSunDirection` points FROM the scene TOWARD the sun (i.e. the direction light
 * comes from, normalized). At dayPhase 0.5 (noon) the sun is high; at 0.25 / 0.75 it is on the
 * horizon (sunrise / sunset); around 0.0 / 1.0 it is below the horizon (night).
 */

export interface SunState {
  /** Unit vector from scene toward the sun. */
  direction: Vector3
  /** Approximate sun/key-light color for this time of day. */
  color: Color
  /** Key-light intensity 0..1 (0 at deep night, peak near noon). */
  intensity: number
  /** Convenience 0..1: how much it is "day" (drives ambient, window-light blend, fog density). */
  daylight: number
}

// scratch objects reused each call to avoid per-frame allocation
const _dir = new Vector3()
const _color = new Color()
const COLOR_NIGHT = new Color('#0a1430')
const COLOR_GOLDEN = new Color('#ff9d5c')
const COLOR_NOON = new Color('#fff4e0')

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

/**
 * Compute sun state for a given dayPhase. Writes into `out` (reused) and returns it.
 * The sun travels a simple arc: azimuth sweeps across the sky over the day, elevation
 * peaks at noon. Good enough to read as a believable day/night cycle; the shader engineer
 * can refine the sky model on top of the same direction vector.
 */
export function computeSun(dayPhase: number, out: SunState): SunState {
  // elevation angle: below horizon at night, +90deg-ish at noon.
  // phase 0.25 -> 0 (sunrise), 0.5 -> max (noon), 0.75 -> 0 (sunset).
  const elevation = Math.sin((dayPhase - 0.25) * Math.PI * 2) // -1..1
  const elevAngle = (elevation * Math.PI) / 2 // radians, -90deg..+90deg
  // azimuth: rotate around Y across the day so shadows sweep.
  const azimuth = (dayPhase - 0.25) * Math.PI * 2

  _dir.set(Math.cos(elevAngle) * Math.cos(azimuth), Math.sin(elevAngle), Math.cos(elevAngle) * Math.sin(azimuth))
  out.direction.copy(_dir).normalize()

  // daylight: 0 when sun well below horizon, 1 when comfortably above.
  const daylight = smoothstep(-0.12, 0.18, elevation)
  out.daylight = daylight

  // intensity: zero at night, ramps with daylight.
  out.intensity = daylight

  // color: night -> golden (low sun) -> noon (high sun).
  // "goldenness" peaks when the sun is near the horizon during daytime.
  const goldness = clamp01(1 - Math.abs(elevation) * 2.2) * daylight
  _color.copy(COLOR_NIGHT).lerp(COLOR_GOLDEN, daylight)
  _color.lerp(COLOR_NOON, smoothstep(0.25, 0.8, elevation))
  _color.lerp(COLOR_GOLDEN, goldness * 0.5)
  out.color.copy(_color)

  return out
}

export function makeSunState(): SunState {
  return {
    direction: new Vector3(0, 1, 0),
    color: new Color('#ffffff'),
    intensity: 1,
    daylight: 1,
  }
}

/**
 * Atmosphere/sky color for a given daylight 0..1, used for the scene background AND the fog color
 * so the horizon and the fog match (a cheap but effective realism cue). Night is deep blue, day is
 * a soft hazy blue. Writes into `out` and returns it. The shader engineer can later replace the
 * flat background with a procedural SkyMesh keyed off the same uSunDirection.
 */
const SKY_NIGHT = new Color('#070b18')
const SKY_DAY = new Color('#9bb8d8')
const _sky = new Color()

export function computeSkyColor(daylight: number, out: Color): Color {
  out.copy(_sky.copy(SKY_NIGHT).lerp(SKY_DAY, clamp01(daylight)))
  return out
}
