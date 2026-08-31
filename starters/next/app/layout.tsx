import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

// Il layout è un SERVER component: qui vivono metadata (SEO vero, non tag iniettati a runtime)
// e il CSS globale coi token del kit (npm run tokens:pull li aggiorna da ../../src/styles).
// Font: in produzione cliente si self-hostano da lib/fonts del kit via next/font/local —
// MAI fonts.googleapis.com a runtime (sentenza Monaco, regola dura del kit).
export const metadata: Metadata = {
  title: 'Form in Motion — starter Next del kit web3d',
  description:
    'Starter App Router: poster server-rendered che vince l’LCP, scena WebGPU dietro un confine client-only, View Transitions fra le route.',
  openGraph: {
    title: 'Form in Motion',
    description: 'La forma segue. Tu guidi.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  )
}
