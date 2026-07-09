#!/bin/bash
# PostToolUse hook (Edit|Write): lint immediato del file toccato — l'errore torna all'agente.
# Solo src/**/*.ts[x]; veloce (eslint singolo file), il typecheck completo resta a CI/build.
set -euo pipefail
INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null || true)
case "$FILE" in
  */src/*.ts|*/src/*.tsx)
    cd "$CLAUDE_PROJECT_DIR"
    if ! OUT=$(npx --no-install eslint --no-warn-ignored "$FILE" 2>&1); then
      echo "eslint FAIL su $FILE:" >&2
      echo "$OUT" >&2
      exit 2   # exit 2 = feedback bloccante all'agente, che corregge subito
    fi
    ;;
esac
exit 0
