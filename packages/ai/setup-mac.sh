#!/usr/bin/env bash
# Installs the Always AI prototype on a Mac with Ollama, then optionally runs the prompt checker.
# Usage: packages/ai/setup-mac.sh <ollama tag for Inkling 2 Mini> [--eval]
set -euo pipefail

TAG="${1:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"

if [[ -z "$TAG" ]]; then
  echo "Usage: $0 <ollama tag for Inkling 2 Mini> [--eval]"
  echo "Find the tag on ollama.com or in the model card on Hugging Face."
  exit 1
fi

if [[ "$(uname)" != "Darwin" ]]; then echo "This script is for macOS. See packages/ai/README.md for other systems."; exit 1; fi

MEM_GB=$(( $(sysctl -n hw.memsize) / 1073741824 ))
if (( MEM_GB < 32 )); then
  echo "This Mac has ${MEM_GB} GB of memory. Inkling 2 Mini needs at least 32 GB."
  exit 1
fi

if ! command -v ollama >/dev/null 2>&1; then
  echo "Ollama is not installed. Install it from https://ollama.com/download, open it once, then run this again."
  exit 1
fi

echo "Downloading ${TAG} (about 20 GB)..."
ollama pull "$TAG"

TMP="$(mktemp -t always-ai-modelfile)"
sed "s|^FROM .*|FROM ${TAG}|" "$HERE/Modelfile" > "$TMP"
ollama create always-ai -f "$TMP"
rm -f "$TMP"
echo "Always AI is installed. Start it with: ollama run always-ai"

if [[ "${2:-}" == "--eval" ]]; then
  if ! command -v npm >/dev/null 2>&1; then echo "Install Node.js 20 or later to run the prompt checker."; exit 1; fi
  cd "$HERE/../.."
  npm install --silent
  ALWAYS_AI_MODEL=always-ai npm run -s ai:eval
  echo "Read the report in packages/ai/evals/reports/ before drawing conclusions."
fi
