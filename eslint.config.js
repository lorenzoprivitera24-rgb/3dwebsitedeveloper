// Flat ESLint config — lints src/ only (lib/ holds vendored shelves we patch, not lint).
// Mechanically enforces the CLAUDE.md non-negotiables it can see: the framer-motion-3d ban
// and the R3F render-loop allocation rules.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import r3f from '@react-three/eslint-plugin'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'lib/**', 'public/**', 'scripts/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'registry/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, '@react-three': r3f },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // No allocations inside useFrame (per-frame GC pressure).
      '@react-three/no-clone-in-loop': 'error',
      '@react-three/no-new-in-loop': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'framer-motion-3d',
              message:
                'BANNED (CLAUDE.md rule 1): discontinued, breaks React 19. Animate 3D via useFrame / GSAP / @react-spring/three.',
            },
          ],
        },
      ],
      // Le non-negoziabili STRUTTURALI del CLAUDE.md diventano regole: una regola che il
      // linter può bocciare non ha bisogno di stare nel contesto del modello. Le altre due
      // nature restano altrove — le COMPORTAMENTALI le verifica il gate di stato
      // (qa:state: convergenza degli uniform), le OPERATIVE il gate frame (qa:frames).
      'no-restricted-syntax': [
        'error',
        {
          // regola 3 — un solo loop RAF (Lenis + gsap.ticker). Deroga motivata: eslint-disable
          // con il perché sulla riga.
          selector: 'CallExpression[callee.name="requestAnimationFrame"]',
          message:
            'CLAUDE.md regola 3: un solo loop RAF (Lenis + gsap.ticker). Usa useFrame o gsap.ticker; se serve davvero un RAF proprio, disabilita la regola sulla riga spiegando perché.',
        },
        {
          selector: 'CallExpression[callee.property.name="requestAnimationFrame"]',
          message:
            'CLAUDE.md regola 3: un solo loop RAF (Lenis + gsap.ticker). Usa useFrame o gsap.ticker.',
        },
        {
          // GDPR: <Environment preset> scarica l'HDRI da una CDN terza. Gli HDRI si self-hostano.
          selector: 'JSXOpeningElement[name.name="Environment"] > JSXAttribute[name.name="preset"]',
          message:
            'GDPR: <Environment preset> scarica da CDN terza. Self-hosta l\'HDRI e usa <Environment files="/hdri/...">.',
        },
      ],
    },
  },
  {
    // regola 8 — nessuno storage del browser nel layer canvas (stato transitorio in ref/state).
    files: ['src/canvas/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'CLAUDE.md regola 8: niente storage del browser nel layer canvas.' },
        { name: 'sessionStorage', message: 'CLAUDE.md regola 8: niente storage del browser nel layer canvas.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'localStorage', message: 'CLAUDE.md regola 8: niente storage del browser nel layer canvas.' },
        { object: 'window', property: 'sessionStorage', message: 'CLAUDE.md regola 8: niente storage del browser nel layer canvas.' },
      ],
    },
  },
)
