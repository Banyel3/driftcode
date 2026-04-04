#!/bin/sh
# ─── DriftCode server entrypoint ─────────────────────────────────────────────
#
# Runs before starting `opencode serve`. Handles:
#   1. Authenticating gh CLI with the GitHub token (if provided)
#   2. Configuring git globals
#   3. Starting opencode in headless server mode
#
# Environment variables:
#   OPENCODE_SERVER_PASSWORD  — required, set by docker-compose from .env
#   GITHUB_TOKEN              — optional, injected by the app during clone flow
# ─────────────────────────────────────────────────────────────────────────────
set -e

# Authenticate gh CLI if a GitHub token is provided
if [ -n "${GITHUB_TOKEN:-}" ]; then
  echo "${GITHUB_TOKEN}" | gh auth login --with-token
  echo "[driftcode] gh CLI authenticated with GitHub token"
fi

# Set sensible git globals (needed for commits triggered by the AI agent)
git config --global user.email "agent@driftcode.dev" 2>/dev/null || true
git config --global user.name "DriftCode Agent" 2>/dev/null || true
git config --global init.defaultBranch main 2>/dev/null || true
git config --global credential.helper store 2>/dev/null || true

echo "[driftcode] Starting opencode server on port 4096..."
exec opencode serve --hostname 0.0.0.0 --port 4096
