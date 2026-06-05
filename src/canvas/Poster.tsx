// Static fallback when the device cannot create any WebGL context.
// The page must never be blank: the content lives on, just without the 3D layer.
export function Poster() {
  return (
    <div className="poster" role="img" aria-label="Form in Motion">
      <p className="poster__eyebrow">3D unavailable on this device</p>
      <h1 className="poster__title">Form in Motion</h1>
      <p className="poster__body">
        Your browser cannot render the interactive scene, so here is the calm version. Everything
        else on the page works exactly the same.
      </p>
    </div>
  )
}
