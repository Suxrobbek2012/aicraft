#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELS_DIR="$SCRIPT_DIR/.ollama-models"
MODEL_NAME="llama3.2:3b"
CUSTOM_MODEL="uz-chat"
PORT="3011"

log() {
  echo "[$(date '+%H:%M:%S')] $*"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    log "Error: '$1' is not installed or not available in PATH."
    exit 1
  }
}

log "Checking required tools..."
require_command ollama
require_command npm
require_command bash

log "Ensuring Ollama service is running..."
if ! pgrep -f "ollama serve" >/dev/null 2>&1; then
  log "Starting ollama serve in the background..."
  ollama serve >"$SCRIPT_DIR/.ollama-serve.log" 2>&1 &
  sleep 5
fi

log "Pulling model $MODEL_NAME..."
ollama pull "$MODEL_NAME"

log "Creating custom model $CUSTOM_MODEL..."
mkdir -p "$MODELS_DIR"
cat > "$MODELS_DIR/Modelfile" <<'EOF'
FROM llama3.2:3b
SYSTEM You are a helpful assistant. Respond in Uzbek language. Be concise, clear, and accurate.
EOF

ollama rm "$CUSTOM_MODEL" >/dev/null 2>&1 || true
ollama create "$CUSTOM_MODEL" -f "$MODELS_DIR/Modelfile"

log "Checking port $PORT..."
if netstat -ano 2>/dev/null | grep -q ":$PORT "; then
  log "Port $PORT is busy. Trying to free it..."
  PID=$(netstat -ano 2>/dev/null | awk -v port=":$PORT" '$0 ~ port {print $5}' | head -n 1 | sed -E 's/.*:([0-9]+)$/\1/' || true)
  if [ -n "$PID" ] && [ "$PID" != "0" ]; then
    taskkill //F //PID "$PID" 2>/dev/null || true
    sleep 2
  fi
fi

log "Starting the app from $SCRIPT_DIR..."
cd "$SCRIPT_DIR"
npm run dev
