// Hero Patterns — framework-agnostic helper (no deps, no runtime CDN).
// Patterns by Steve Schoger — heropatterns.com — licensed CC BY 4.0.
// Usage:  element.style.backgroundImage = heroPattern('topography', '#6366f1', 0.35)
import patterns from './patterns.json' with { type: 'json' };

export const patternNames = Object.keys(patterns);

/** Return a themed CSS background-image value for a Hero Pattern. */
export function heroPattern(name, color = '#9C92AC', opacity = 0.4) {
  const tpl = patterns[name];
  if (!tpl) throw new Error(`Unknown hero pattern: ${name}. Try one of ${patternNames.join(', ')}`);
  return tpl
    .replaceAll('FILLCOLOR', String(color).replace('#', '%23'))
    .replaceAll('FILLOPACITY', String(opacity));
}

export default heroPattern;
