#!/usr/bin/env bash
# One-time setup of the Always API secrets on Vercel, run by a maintainer on their own computer.
# Keys are generated here and sent straight to Vercel as Sensitive variables; nothing is written to disk.
# Needs Node 20+ and openssl. Usage: bash scripts/setup-secrets.sh
set -euo pipefail
SCOPE="${VERCEL_SCOPE:-daniel-5056s-projects}"
PROJECT="${VERCEL_PROJECT:-always-api}"
VERCEL="npx --yes vercel@latest"

echo "Signing in to Vercel (a browser window may open)..."
$VERCEL whoami >/dev/null 2>&1 || $VERCEL login
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
( cd "$tmp" && $VERCEL link --yes --project "$PROJECT" --scope "$SCOPE" >/dev/null )

echo
echo "Paste the Supabase Transaction pooler connection string (Supabase > Connect, port 6543),"
echo "with your database password filled in. It won't be shown as you paste."
read -r -s -p "DATABASE_URL: " DATABASE_URL; echo
case "$DATABASE_URL" in postgres://*|postgresql://*) ;; *) echo "That doesn't look like a Postgres URL." >&2; exit 1;; esac

FIELD_KEY="$(openssl rand -base64 32)"
HASH_KEY="$(openssl rand -base64 32)"
AUTH_JWT_SECRET="$(openssl rand -hex 32)"

add() { # name value
  for target in production preview; do
    ( cd "$tmp" && $VERCEL env rm "$1" "$target" --yes --scope "$SCOPE" >/dev/null 2>&1 || true )
    ( cd "$tmp" && printf '%s' "$2" | $VERCEL env add "$1" "$target" --sensitive --scope "$SCOPE" >/dev/null )
  done
  echo "  set $1"
}
echo "Saving to Vercel project $PROJECT..."
add DATABASE_URL "$DATABASE_URL"
add FIELD_KEY "$FIELD_KEY"
add HASH_KEY "$HASH_KEY"
add AUTH_JWT_SECRET "$AUTH_JWT_SECRET"

echo
echo "Done. One thing to keep: save this FIELD_KEY in your password manager now."
echo "Without it, people's encrypted details can't be read if the Vercel variable is ever lost."
echo
echo "  FIELD_KEY=$FIELD_KEY"
echo
read -r -p "Press Enter once it's saved, and this window's copy will be cleared." _
clear 2>/dev/null || printf '\033c'
echo "All set. The cron secret is handled inside Supabase, so there's nothing else to copy."
