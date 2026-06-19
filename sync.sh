#!/usr/bin/env bash
# Sync the latest spoon-tracker file Claude gave you into the repo, then push.
#
#   1. Download the updated file from Claude (it lands in ~/Downloads as
#      spoon-tracker.jsx — repeats may be "spoon-tracker (1).jsx", etc.)
#   2. Run:  ./sync.sh "what changed"
#
set -euo pipefail

SRC_DIR="${HOME}/Downloads"
latest="$(ls -t "${SRC_DIR}"/spoon-tracker*.jsx 2>/dev/null | head -1 || true)"

if [ -z "${latest}" ]; then
  echo "✗ No spoon-tracker*.jsx in ${SRC_DIR}. Download it from Claude first."
  exit 1
fi

echo "→ using: ${latest}"
cp "${latest}" src/App.jsx

ver="$(grep -oE 'APP_VERSION = "[^"]+"' src/App.jsx | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "")"
echo "→ app version in file: ${ver:-unknown}"

if git diff --quiet -- src/App.jsx; then
  echo "• No change vs current src/App.jsx — nothing to commit."
  exit 0
fi

git add -A
git commit -m "${1:-ui: update from Claude}"

if git remote get-url origin >/dev/null 2>&1; then
  git push
  echo "✓ committed and pushed."
else
  echo "✓ committed locally. (No GitHub remote yet — see README 'Connect to GitHub' to set one up; the commit will push next time.)"
fi
