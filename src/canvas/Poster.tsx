// Static fallback when the device cannot create any WebGL context (so WebGPU/WebGL2 are both out).
// The page must never be blank: show a styled DOM hero so the city concept still reads.
export function Poster() {
  return (
    <div className="poster" role="img" aria-label="Live City simulator">
      <p className="poster__eyebrow">3D unavailable on this device</p>
      <h1 className="poster__title">Live City</h1>
      <p className="poster__body">
        Your browser cannot create a WebGL context, so the interactive city is not available here.
        On a WebGPU- or WebGL2-capable browser this shows a living procedural city with a real
        day/night cycle and traffic.
      </p>
    </div>
  )
}
