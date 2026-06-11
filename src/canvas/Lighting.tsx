/**
 * Ambient fill lights. The KEY light (the shadow-casting sun) lives in SimClockDriver because it
 * is driven by the day/night cycle; this file holds only the cheap, constant fill so the night
 * city is never fully black and shadowed faces keep some bounce.
 *
 * Budget: 2 fill lights here + 1 sun = 3 dynamic lights total (within the desktop budget; the
 * low tier turns the sun's shadow pass off but keeps the light). Window lights / street lamps /
 * headlights are EMISSIVE material output (shader engineer), not scene lights, so they cost
 * nothing in the light budget.
 *
 * [shader engineer] extension point: replace this with an Environment/IBL (PMREM of a procedural
 * sky) for richer reflections on the car metal and glass facades.
 */
export function Lighting() {
  return (
    <>
      {/* sky/ground hemisphere fill: cool from above, warm bounce from the ground */}
      <hemisphereLight args={['#9fb8ff', '#1a1712', 0.25]} />
      {/* very low ambient so nothing is pure black */}
      <ambientLight intensity={0.08} />
    </>
  )
}
