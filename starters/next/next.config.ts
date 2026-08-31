import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    // React <ViewTransition>: il sipario fra route senza WebGL (gap analysis riga 8).
    // Cross-document VT (CSS @view-transition) resta l'alternativa quando questo flag balla.
    viewTransition: true,
  },
}

export default nextConfig
