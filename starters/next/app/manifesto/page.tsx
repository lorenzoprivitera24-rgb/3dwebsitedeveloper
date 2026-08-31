import Link from 'next/link'

// Seconda route: esiste per esercitare la View Transition di ritorno e per dimostrare che le
// pagine di contenuto sono SOLO server components — zero JS di scena, zero idratazione inutile.
export const metadata = {
  title: 'Manifesto — Form in Motion',
  description: 'La forma segue. Tu guidi.',
}

export default function Manifesto() {
  return (
    <main className="page">
      <section className="hero" aria-labelledby="manifesto-title">
        <p className="eyebrow">manifesto</p>
        <h1 id="manifesto-title" className="display">
          La forma segue.
          <br />
          Tu guidi.
        </h1>
        <p className="lede">
          Una pagina di solo contenuto: nessun canvas, nessun chunk three, HTML completo alla
          prima risposta. La transizione da e verso la home è una View Transition: il sipario non
          ha bisogno di WebGL.
        </p>
        <Link className="cta" href="/">
          ← Torna alla scena
        </Link>
      </section>
    </main>
  )
}
