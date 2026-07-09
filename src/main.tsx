import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
// Self-hosted type (lib/fonts shelf) — NEVER the Google Fonts CDN at runtime (GDPR,
// Munich ruling 3 O 17493/20). Display: Fraunces. Body: Schibsted Grotesk.
import '../lib/fonts/Fraunces/font.css'
import '../lib/fonts/SchibstedGrotesk/font.css'
import './styles.css'

// Note: StrictMode double-mounts in development. useGSAP and ReactLenis handle their own cleanup,
// so this is fine; if you ever see a doubled init only in dev, StrictMode is the reason.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
