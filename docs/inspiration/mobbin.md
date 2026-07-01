# Mobbin — UX pattern reference (links only, no assets)

> Mobbin is a searchable library of real-app UI/UX screenshots and flows. This kit treats it as a
> **reference-only lookbook**: a place to decide *what* to build (which pattern, which flow order,
> which states to design), never a place to copy pixels from. There is **nothing to vendor** — this
> file is a curated pattern taxonomy + linkable browse guide, and it stores **zero screenshots**.

Important notes for agents:

- Mobbin is **reference-only.** Every screenshot on it is another app's copyrighted UI. Use it to
  study patterns and flows, then build with **this kit's own shelves** (see the map below).
- **No assets live in this repo.** There is no `lib/mobbin/` and there never will be — that would
  mean mirroring copyrighted third-party screenshots. This file is text + links, full stop.
- **Links open on mobbin.com**, behind your own account. Do not embed, download, or paste their
  images anywhere in the project.

## The honest legal reality

- **What it is.** Mobbin catalogs screens and end-to-end flows from thousands of shipping iOS,
  Android, and web apps, tagged by app, pattern, and UI element so you can search "onboarding" or
  "empty state" across many products at once.
- **The screenshots are other apps' copyrighted UI.** Mobbin licenses/curates them for *browsing and
  inspiration*. Its terms allow you to look; they **do not** grant you the right to redistribute,
  scrape, bulk-export, or mirror them. A paid seat is still "one copy, personal, reference use" — it
  is not an asset license.
- **Access.** There's a limited free tier and a Pro tier (roughly ~$10–15/mo depending on plan and
  billing). Browse **under your own account** in a browser — do not automate, scrape, or cache pages.
- **For this repo:** treat Mobbin like a museum, not a warehouse. You leave with *ideas and
  decisions*, not files. No screenshots are stored here; no scraping tooling is referenced or used.

## Pattern taxonomy (what to look up, and why it works)

For each pattern: one line on what makes it work, then a public Mobbin explore link to browse real
examples. **Links only — never embed the images.** (Explore URLs point at Mobbin's category browse;
if a slug 404s, use Mobbin's own search bar for the pattern name.)

- **Hero / landing** — one clear promise + one primary action above the fold; the 3D/motion is the
  proof, not the message. Browse: <https://mobbin.com/explore/web/marketing/landing-page>
- **Onboarding** — earn one step of effort at a time; show progress, defer optional setup, reach
  "first value" fast. Browse: <https://mobbin.com/explore/apps/flows/onboarding>
- **Pricing / paywall** — anchor with a recommended tier, make the value-per-tier scannable, remove
  doubt right next to the CTA. Browse: <https://mobbin.com/explore/apps/screens/paywall>
- **Empty states** — turn "nothing here yet" into a first action: explain, illustrate, give one
  obvious next step. Browse: <https://mobbin.com/explore/apps/screens/empty-state>
- **Navigation / menus** — the fewest destinations that cover the job; current location always
  legible; motion clarifies hierarchy, never hides it. Browse:
  <https://mobbin.com/explore/apps/screens/navigation>
- **Search** — instant feedback, forgiving input, useful zero-query and no-results states, results
  you can trust and refine. Browse: <https://mobbin.com/explore/apps/screens/search>
- **Settings** — flat, grouped, boring on purpose; destructive actions guarded, defaults sane.
  Browse: <https://mobbin.com/explore/apps/screens/settings>
- **Checkout** — one column, visible total, guest path, trust cues; every field you cut lifts
  completion. Browse: <https://mobbin.com/explore/apps/flows/checkout>
- **Auth / sign-in** — minimum friction to a real account; SSO first, clear error and recovery
  paths, no dead ends. Browse: <https://mobbin.com/explore/apps/flows/sign-up>
- **Notifications / toasts** — say what happened, offer the undo/next action, then get out of the
  way; never block the flow. Browse: <https://mobbin.com/explore/apps/screens/notification>
- **Cards / lists** — one scannable unit repeated; consistent hierarchy, a clear tap target, room
  to breathe. Browse: <https://mobbin.com/explore/apps/screens/list>
- **Testimonials / social proof** — specific, attributed, believable; a real face and a real result
  beats five stars with no name. Browse: <https://mobbin.com/explore/web/marketing/testimonials>
- **Footers** — the quiet index: wayfinding, legal, and reassurance without clutter. Browse:
  <https://mobbin.com/explore/web/marketing/footer>
- **Loading / skeleton** — set the shape of what's coming so waiting feels shorter; skeletons over
  spinners, honest progress over fake bars. Browse:
  <https://mobbin.com/explore/apps/screens/loading>

## Map, not material

Mobbin tells you **what** to build; the kit's own shelves are **what you build it from**. Once a
pattern above has settled the decision (which flow, which states, which layout), compose it from:

- **`lib/react-bits/`** — the interactivity layer (headline effects, scroll reveals, cursor/hover
  toys, animated menus, galleries, animated backgrounds). Start at
  [`../../lib/react-bits/CATALOG.md`](../../lib/react-bits/CATALOG.md).
- **`lib/componentry/`** — the UI building blocks (nav, cards, forms, pricing, footers…).
- **`lib/patterns/`** — reusable page/section compositions to assemble a screen fast.
- **`lib/illustrations/`** — self-hosted art for empty states, heroes, and social proof.

And keep the kit's hard constraints while you translate a Mobbin idea into a real screen:

- **No third-party CDN at runtime (GDPR).** Self-host everything — fonts, images, illustrations,
  scripts. A Mobbin reference never becomes a hotlink or an embedded asset.
- **Honor `prefers-reduced-motion`.** If a pattern you liked is motion-heavy, gate the animation and
  keep the content and meaning.
- **One RAF / scroll loop.** Scroll-reactive patterns read the host's Lenis+GSAP loop — don't spin a
  second `requestAnimationFrame` to recreate a flashy scroll effect you saw.
- **Respect the two layers.** UI patterns (nav, forms, toasts, checkout) live in the **DOM/overlay**
  layer; the R3F `<Canvas>` is the 3D layer beneath. Keep text, focus order, and controls in the DOM
  — don't rebuild a menu or a form inside the canvas.

Bottom line: browse Mobbin to *choose the pattern and the states*, then build it here with
react-bits + componentry + patterns + illustrations. Leave the screenshots on their site.
