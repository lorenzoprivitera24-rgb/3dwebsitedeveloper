import Link from 'next/link'
import { CanvasShell } from '../components/CanvasShell'

// La home è un SERVER component: TUTTO il testo qui sotto arriva nell'HTML della risposta.
// L'elemento LCP è il titolo del poster — testo server-rendered, non un canvas: è così che il
// genere vince i Core Web Vitals (gap analysis riga 15). La scena WebGPU si monta DOPO, dietro
// (CanvasShell è client-only e il suo chunk non blocca niente).
export default function Home() {
  return (
    <main className="page">
      <CanvasShell />
      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">webgpu / tsl / next app router</p>
        <h1 id="hero-title" className="display">
          Form in Motion
        </h1>
        <p className="lede">
          Il poster è HTML server-rendered e vince l&rsquo;LCP; la scena 3D arriva quando arriva,
          dietro, senza bloccare nulla. Questo è lo starter per i siti che devono indicizzare.
        </p>
        <Link className="cta" href="/manifesto">
          Il manifesto →
        </Link>
      </section>
      <section className="body-copy">
        <h2>Perché un gemello Next</h2>
        <p>
          La SPA Vite del kit è il laboratorio: un solo documento, tutto client. Un sito cliente
          però vive di ricerca organica — e lì l&rsquo;HTML della prima risposta È il prodotto:
          titoli, copy e link devono esistere prima di qualunque JavaScript.
        </p>
        <p>
          La regola 9 del kit (niente three nel grafo statico dell&rsquo;entry) qui diventa
          architettura: il canvas sta dietro <code>dynamic(..., &#123; ssr: false &#125;)</code> in
          un client component, quindi il server bundle non sa nemmeno che three esiste.
        </p>
      </section>
    </main>
  )
}
