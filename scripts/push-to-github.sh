#!/usr/bin/env bash
# push-to-github.sh — create a GitHub repo and push the local `main` branch.
#
# Requires a GitHub personal access token with `repo` scope. The token is read
# from an argument, $GH_TOKEN, or a file — never hardcoded. The push URL
# carries the token only for the single push; it is NOT written to .git/config,
# so the repo afterwards uses the clean (token-less) origin URL.
#
# Usage:
#   ./scripts/push-to-github.sh <token> [repo-name] [public|private]
#   GH_TOKEN=... ./scripts/push-to-github.sh
#
# Safe to re-run: it will not error if the repo already exists or the remote
# is already configured.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

TOKEN="${1:-${GH_TOKEN:-}}"
REPO="${2:-latent-vault}"
VIS="${3:-private}"

if [[ -z "$TOKEN" && -r "$HOME/.config/github/token" ]]; then
  TOKEN="$(tr -d '\n\r' < "$HOME/.config/github/token")"
fi
if [[ -z "$TOKEN" ]]; then
  echo "error: no GitHub token. Pass it as \$1, set \$GH_TOKEN, or place it in ~/.config/github/token" >&2
  exit 64
fi

API="https://api.github.com"
auth=(-H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json")

echo "== who am I =="
LOGIN="$(curl -sS --max-time 30 "${auth[@]}" "$API/user" | sed -n 's/.*"login": *"\([^"]*\)".*/\1/p' | head -1)"
if [[ -z "$LOGIN" ]]; then
  echo "error: token rejected or no 'user' read. Check scope (repo)." >&2
  exit 77
fi
echo "  authenticated as: $LOGIN"

echo "== ensure repo $LOGIN/$REPO ($VIS) =="
code="$(curl -sS --max-time 30 -o /tmp/gh-create.json -w '%{http_code}' \
  "${auth[@]}" -X POST "$API/user/repos" \
  -d "{\"name\":\"$REPO\",\"private\":$([ "$VIS" = public ] && echo false || echo true),\"auto_init\":false}")"
case "$code" in
  201) echo "  created." ;;
  422) echo "  already exists — reusing." ;;
  *)   echo "  create returned $code:"; sed -n 's/.*"message": *"\([^"]*\)".*/   \1/p' /tmp/gh-create.json; exit 1 ;;
esac

ORIGIN="https://github.com/$LOGIN/$REPO.git"

echo "== set clean origin (no token stored) =="
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$ORIGIN"
else
  git remote add origin "$ORIGIN"
fi

echo "== push (token used once, not persisted) =="
git push "https://x-access-token:$TOKEN@github.com/$LOGIN/$REPO.git" "HEAD:refs/heads/main"
git branch --set-upstream-to=origin/main main 2>/dev/null || true

echo
echo "done: $ORIGIN"
