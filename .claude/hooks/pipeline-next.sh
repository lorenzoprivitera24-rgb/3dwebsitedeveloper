#!/bin/bash
# Stop hook: a fine turno ricorda lo stadio corrente della pipeline (gate umani = decide Lorenzo).
# Non blocca mai: solo contesto.
set -uo pipefail
STATUS_FILE="$CLAUDE_PROJECT_DIR/PIPELINE_STATUS.md"
[ -f "$STATUS_FILE" ] || exit 0
LINE=$(grep -m1 '^- \*\*Stadio corrente\*\*' "$STATUS_FILE" 2>/dev/null || true)
[ -n "$LINE" ] && echo "Pipeline → ${LINE#- } · comandi e regole: CLAUDE.md § The factory (aggiorna PIPELINE_STATUS.md se lo stadio è cambiato)."
exit 0
