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
    files: ['src/**/*.{ts,tsx}'],
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
    },
  },
)
