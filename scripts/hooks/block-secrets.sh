#!/usr/bin/env bash
# Blocks git commits when staged changes look like they contain secrets or Australian personal identifiers.
# Reads the Claude Code hook payload on stdin; only acts on `git commit` commands.
set -euo pipefail
payload="$(cat)"
if ! printf '%s' "$payload" | grep -q '"git commit'; then exit 0; fi
diff="$(git diff --cached -U0 || true)"
patterns='(AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|sk_live_[0-9a-zA-Z]{20,}|xox[baprs]-[0-9A-Za-z-]{10,}|ghp_[0-9A-Za-z]{36}|04[0-9]{2} ?[0-9]{3} ?[0-9]{3})'
if printf '%s' "$diff" | grep -Eq "$patterns"; then
  echo "Blocked: staged changes look like they contain a secret or a real phone number. Use synthetic fixtures and environment variables." >&2
  exit 2
fi
exit 0
