#!/usr/bin/env python3
"""
3D-website — Auto-dispatch hook (UserPromptSubmit).

Runs on every prompt: reads the request, figures out which 3D specialist it
belongs to, and injects a reminder so the main session delegates to the right
sub-agent immediately (engaging the specialist is the default, not something to
ask permission for). Source of the routing: CLAUDE.md "Orchestration" + each
agent's description.

IMPORTANT for this stack: research/independent work runs in parallel, but EDITS
are serialized (one owner per property, one RAF loop) to avoid jitter/conflicts;
parallel edits only on worktree-isolated branches.

Reads the hook JSON from stdin; on a match prints context to stdout (added to the
turn) and exits 0. No match -> no output. Never blocks the prompt.
"""
import sys
import json
import re

# (label, pattern, route) — bilingual IT/EN domain triggers (even short/vague).
CATEGORIES = [
    ("architecture",
     r"\bscena\b|scene\s*graph|architettur|struttur.*(progett|3d)|\brenderer\b|webgpu|webgl|"
     r"\bcanvas\b|\br3f\b|react\s*three\s*fiber|\bthree\.?js\b|skeleton|setup\s+(del\s+)?progett|"
     r"camera|\bluci\b|light(ing|s)?|asset\s+pipeline|\bdpr\b|fallback\s+setup",
     "Scena/architettura/renderer/setup -> `@agent-r3f-scene-architect` (OWNER dello scheletro: Canvas WebGPU async, scene graph, camera/luci, pipeline asset, loop unico Lenis+GSAP, ARCHITECTURE.md = contratto)."),

    ("shader",
     r"\bshader\b|\btsl\b|displacement|deformazion|distorsion|\bnoise\b|rumore|node\s*material|"
     r"materiale\s+(tsl|node)|rgb\s*shift|chromatic|iridescen|gradient|vertex|particell|\bgpu\s+(particle|comput)|"
     r"morph(ing)?\s+(della\s+)?form|superficie",
     "Shader/displacement/TSL/particelle -> `@agent-tsl-shader-engineer` (node graph TSL renderer-agnostico WGSL+GLSL, espone uniform ben nominati per il contratto)."),

    ("motion",
     r"\bscroll\b|allo\s+scroll|\bpointer\b|\bmouse\b|\btouch\b|\btocco\b|\bgsap\b|scrolltrigger|"
     r"scrollsmoother|\blenis\b|timeline|parallax|\bpin\b|pinned|scrub|damp|lega\s+lo\s+scroll|"
     r"sincronizza|movimento\s+al\s+(mouse|tocco)|cinematograf",
     "Scroll/pointer/timeline/binding uniform -> `@agent-scroll-motion-engineer` (GSAP ScrollTrigger + Lenis in UN loop, lega scroll/pointer agli uniform e alla camera, tuning damping desktop+mobile)."),

    ("ui-a11y",
     r"\bui\b|interfacc|\boverlay\b|\bmenu\b|\bdom\b|\bhtml\b|responsiv|\btouch\b\s+ergonom|"
     r"transizion[ei]\s+(di\s+)?pagina|micro[-\s]?interazion|\bmotion\b\s*\(|motion/react|"
     r"accessibilit|\bwcag\b|\baria\b|contrast|reduced[-\s]?motion|focus\s+order|tastier",
     "Overlay DOM / UI / accessibilità -> `@agent-ui-overlay-a11y-engineer` (Motion = solo DOM; responsive+touch, prefers-reduced-motion, ARIA, contrasto sul background in movimento)."),

    ("perf-audit",
     r"performance|prestazion|\baudit\b|\bottimizz|scatta|\blag\b|\bfps\b|frame\s*budget|draw\s*call|"
     r"instanc|budget\s+mobile|prima\s+del\s+rilasci|verifica\s+il\s+fallback|il\s+sito\s+(scatta|va\s+lento)",
     "Performance/fallback/accessibilità (PRIMA del rilascio) -> `@agent-perf-fallback-auditor` (READ-ONLY: draw call, instancing, DPR, fallback WebGPU->WebGL2, poster no-WebGL, reduced-motion, a11y -> report prioritizzato che 1-4 applicano)."),

    # ---- fabbrica (pipeline cliente S0-S7, vedi PIPELINE_STATUS.md) ----
    ("intake",
     r"\bbrief\b|\bintake\b|nuovo\s+client|richiesta\s+(del\s+)?client|preventivo\s+(del\s+)?sito",
     "Nuovo progetto/brief (S0) -> skill `client-intake` + template `brief/_templates/brief.template.md`; il gate S0 e umano."),

    ("direction",
     r"direzione\s+creativ|art\s*direction|\bdirection\.md\b|coppia\s+tipografic|palette\s+(del\s+)?sito|vocabolario\s+di\s+motion",
     "Art direction (S1) -> `@agent-creative-director` (UNA direzione opinionata + blocco tokens eseguibile; font solo dallo scaffale self-host)."),

    ("storyboard",
     r"\bstoryboard\b|sceneggiatur|scaletta\s+(delle\s+)?sezion|coreografia\s+(della\s+)?pagin",
     "Storyboard dello scroll (S2) -> `@agent-scroll-storyboarder` (scena UNA e persistente, blueprint dal registro o CUSTOM, mobile+reduced per sezione)."),

    ("copy",
     r"\bcopy\b|\bheadline\b|\beyebrow\b|microcopy|testi\s+del\s+sito|riempi\s+i\s+contenut",
     "Copy (S3) -> `@agent-copy-chief` (slot ESATTI dallo storyboard in content/*.json; headline <6 parole; niente testo orfano)."),

    ("assets",
     r"\bglb\b|\bgltf\b|\bktx2?\b|\bhdri?\b|asset[-\s]?(3d|manifest|wrangler)|comprimi\s+(i\s+)?(modell|glb|texture)|\bmeshy\b|\btripo\b|poly\s*haven",
     "Asset 3D/texture/HDRI (S4) -> `@agent-asset-wrangler` (npm run assets:encode, budget 5MB/2048px, manifest con licenza per OGNI asset)."),

    ("registry",
     r"\bregistro\b|\bblueprint\b|composition[-\s]?plan|\bcomponi\s+(il\s+sito|le\s+sezioni)|promuovi\s+a\s+blueprint",
     "Composizione dal registro (S5) -> `@agent-blueprint-librarian` (mappa storyboard->blueprint, props dai token, CUSTOM instradati agli specialisti; a fine progetto promuove)."),

    ("visual-qa",
     r"\bqa\b|screenshot\s+(delle\s+)?sezion|verifica\s+(a\s+)?video|issues\.md|guarda\s+il\s+sito|qa:shoot|shoot\.mjs",
     "QA visiva (S6) -> `@agent-visual-qa-operator` (npm run qa:verify + qa:shoot, GUARDA gli screenshot vs storyboard/direction, scrive qa/issues.md; max 3 giri; non corregge codice)."),
]


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0

    prompt = (data.get("prompt") or "")
    if not prompt:
        return 0

    routes = [route for _, pat, route in CATEGORIES if re.search(pat, prompt, re.I)]
    if not routes:
        return 0

    seen = set()
    uniq = [r for r in routes if not (r in seen or seen.add(r))]
    body = "\n".join("- " + r for r in uniq)
    multi = len(uniq) > 1

    parallel = (
        "PIU SPECIALISTI coinvolti: ricerca/analisi indipendente PUO girare in parallelo, ma SERIALIZZA\n"
        "le modifiche ai file (un solo owner per proprieta/uniform, un solo loop RAF) per evitare jitter e\n"
        "conflitti. Per lavoro pesante in parallelo usa isolation: worktree. Catena tipica: scene-architect\n"
        "-> tsl-shader-engineer -> scroll-motion-engineer -> ui-overlay-a11y-engineer -> perf-fallback-auditor.\n\n"
        if multi else
        "Se servono piu competenze, la ricerca indipendente puo essere parallela ma le EDIT vanno serializzate\n"
        "(un owner per proprieta, un loop). ARCHITECTURE.md e il contratto condiviso: tienilo aggiornato.\n\n"
    )

    print(
        "<agents-autostart>\n"
        "AUTO-DISPATCH — 3D website specialists\n\n"
        "Delega SUBITO allo specialista indicato (la sessione principale e l'orchestratore; i sub-agent non\n"
        "ne lanciano altri). Ingaggiare lo specialista e il default, non chiedere il permesso. Route rilevate:\n"
        + body + "\n\n"
        + parallel
        + "Regole non negoziabili dello stack:\n"
        "1. `framer-motion-3d` BANDITO (rotto su React 19). 3D animato via useFrame / React Spring / GSAP; Motion solo DOM.\n"
        "2. UN solo owner per uniform/camera/proprieta; UN solo loop scroll/RAF (Lenis + gsap.ticker).\n"
        "3. Scroll progress in un ref (mai state); EASE tutto con MathUtils.damp prima di uniform/camera.\n"
        "4. Mobile first-class (dpr<=2, instancing, ampiezza/suddivisioni ridotte); accessibilita parte del 'done'.\n"
        "5. Niente browser storage nel layer canvas. Definition of done: vedi CLAUDE.md.\n"
        "6. Lavoro cliente = pipeline S0-S7: leggi PIPELINE_STATUS.md prima di agire; REGOLA D'ORO:\n"
        "   consulta /registry (INDEX.md) prima di scrivere qualunque sezione da zero.\n"
        "Dettaglio: CLAUDE.md (Orchestration + The factory) + skill `web3d-integration-patterns`.\n"
        "</agents-autostart>"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
