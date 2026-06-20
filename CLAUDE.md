# CLAUDE.md: project constitution for a modern 3D website (June 2026)

This file orchestrates the build. The main Claude Code session reads it on startup and uses it
to delegate to the specialized sub-agents in `.claude/agents/`. The deep technical playbook lives
in the `web3d-integration-patterns` skill under `.claude/skills/`.

## What we are building

A modern 3D website where **the geometry and the interface morph as the user scrolls (desktop)
and as they touch the screen (mobile)**. The signature feature is vertex displacement / distortion
driven by two eased signals: scroll progress and pointer position. A DOM interface animates in sync
above the canvas without fighting it.

## The stack (June 2026), and the rules that come with it

- **Renderer**: Three.js r171+ via `three/webgpu`. WebGPU first, automatic WebGL2 fallback. The
  `Canvas` `gl` prop is an **async factory** that calls `await renderer.init()`.
- **React layer**: React Three Fiber v9 on **React 19**.
- **Shaders**: **TSL** (`three/tsl`), node-based, renderer-agnostic (compiles to WGSL and GLSL).
  Raw GLSL strings are a documented exception, not the default.
- **Scroll**: **Lenis**, driven by `gsap.ticker`. One RAF source for the whole app.
- **Scroll/timeline animation**: **GSAP 3.13+** (now fully free, all plugins) with
  `@gsap/react` `useGSAP` and ScrollTrigger / ScrollSmoother.
- **3D object motion**: `useFrame` (with `MathUtils.damp`), `@react-spring/three`, or GSAP.
- **DOM UI motion**: **Motion** (`motion/react`). DOM only.

### Non-negotiable rules

1. **`framer-motion-3d` is banned.** It is discontinued and breaks on React 19. Never import it,
   never use `motion.mesh`. Animate 3D via `useFrame` / React Spring / GSAP. Motion is DOM-only.
2. **One animation owner per property.** A given uniform, camera, or object property is driven by
   exactly one system. Mixing causes jitter.
3. **One scroll/RAF loop.** Lenis + `gsap.ticker` is the single source. No stray
   `requestAnimationFrame` on scroll-linked things.
4. **Scroll progress lives in a ref**, not React state. No per-frame re-renders.
5. **Ease everything.** Scroll and pointer values pass through `MathUtils.damp`
   (framerate-independent) before reaching uniforms or the camera.
6. **Mobile is first-class.** Cap `dpr` at 2, instance repeats, reduce amplitude and subdivisions
   on small viewports, use the quality tiers in the skill.
7. **Accessibility is part of "done".** `prefers-reduced-motion` path, canvas `aria-hidden`,
   interactive controls mirrored in accessible DOM, contrast over the moving background, intact
   keyboard order.
8. **No browser storage** in the canvas layer; transient state in refs/React state.

## Orchestration: how the main session delegates

Sub-agents cannot spawn sub-agents, so this main session is the orchestrator. Default build order
(adapt to the brief):

1. `@agent-r3f-scene-architect`: project skeleton, async WebGPU `Canvas`, scene graph, camera,
   lights, asset pipeline, the single Lenis + GSAP loop, and `ARCHITECTURE.md` defining the
   component contract (the scroll-progress ref and the shader uniforms).
2. `@agent-tsl-shader-engineer`: the TSL node materials (scroll + pointer displacement, RGB shift,
   any compute particles), exposing well-named uniforms per the contract.
3. `@agent-scroll-motion-engineer`: bind scroll progress and pointer/touch to the uniforms and the
   camera, build the ScrollTrigger timeline, tune the damping for desktop and mobile.
4. `@agent-ui-overlay-a11y-engineer`: the DOM overlay with Motion, responsive and touch-friendly,
   with the reduced-motion path and ARIA.
5. `@agent-perf-fallback-auditor`: read-only audit (draw calls, instancing, DPR, fallback,
   reduced-motion, accessibility); returns a prioritized report that 1 to 4 apply.

Chain them: e.g. "Use the tsl-shader-engineer to build the displacement material, then the
scroll-motion-engineer to drive its uniforms from scroll and pointer." Run independent research
in parallel where it helps, but keep edits serialized to avoid conflicts.

**Auto-dispatch (every prompt).** A `UserPromptSubmit` hook (`.claude/hooks/agents-autostart.py`)
reads each request and injects the matching specialist so delegation happens on its own — engaging
the specialist is the default, not something to ask permission for. It also reminds: independent
research can run in parallel, but **serialize edits** (one owner per property, one RAF loop); use
`isolation: worktree` for parallel branches. Same non-negotiables apply (no `framer-motion-3d`, one
loop, ease everything, mobile + a11y in "done").

### Tips

- Let agents accumulate knowledge: `r3f-scene-architect` and (optionally) others use project
  memory under `.claude/agent-memory/`. Ask them to consult and update it.
- For heavy isolated work on a branch, an agent can run with `isolation: worktree`.
- `ARCHITECTURE.md` is the shared source of truth for the component contract. Keep it current.

## Definition of done

- Runs at the frame budget on a throttled mid-tier mobile profile.
- WebGPU path works; WebGL2 fallback works; a no-WebGL poster exists.
- `prefers-reduced-motion` respected; accessibility checklist passed.
- One loop, one owner per property, no `framer-motion-3d`, no browser storage in the canvas.
