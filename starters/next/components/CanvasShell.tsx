'use client'

import dynamic from 'next/dynamic'

// IL confine (regola 9 del kit, versione Next): `ssr: false` dentro un client component è
// l'equivalente del React.lazy della SPA — three, R3F e la scena non esistono né nel server
// bundle né nel percorso critico del client. Il fallback è null di proposito: il poster VERO
// è l'HTML server-rendered che sta già sotto, non un altro spinner.
const CanvasScene = dynamic(() => import('./CanvasScene'), { ssr: false })

export function CanvasShell() {
  return (
    <div className="canvas-layer" aria-hidden="true">
      <CanvasScene />
    </div>
  )
}
