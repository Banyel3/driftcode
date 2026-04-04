#!/usr/bin/env bash
# ─── DriftCode — one-command VPS install script ───────────────────────────────
#
# Usage:
#   curl -fsSL https://driftcode.dev/install | bash
#
# What this does:
#   1. Checks for Docker + Docker Compose
#   2. Creates ~/driftcode-server/
#   3. Downloads docker-compose.yml from GitHub
#   4. Generates a random server password and writes it to .env
#   5. Starts the opencode container
#   6. Waits for the health endpoint
#   7. Prints your server URL + credentials — paste these into the DriftCode app
#
# After install, SSH into your server and run:
#   opencode     → starts the TUI
#   /connect     → connect an LLM provider (GitHub Copilot, Claude, GPT-4, etc.)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

# ── Banner ────────────────────────────────────────────────────────────────────
echo -e "${BLUE}${BOLD}"
echo "  ____       _  __ _    ____          _      "
echo " |  _ \ _ __(_)/ _| |_ / ___|___   __| | ___  "
echo " | | | | '__| | |_| __| |   / _ \ / _\` |/ _ \\ "
echo " | |_| | |  | |  _| |_| |__| (_) | (_| |  __/ "
echo " |____/|_|  |_|_|  \__|\____\___/ \__,_|\___| "
echo -e "${NC}"
echo -e "${BOLD}DriftCode${NC} — AI Coding, Anywhere"
echo ""

# ── Preflight checks ──────────────────────────────────────────────────────────
error() { echo -e "${RED}Error: $1${NC}" >&2; exit 1; }
info()  { echo -e "${BLUE}▶${NC} $1"; }
ok()    { echo -e "${GREEN}✓${NC} $1"; }

command -v docker >/dev/null 2>&1 \
  || error "Docker is not installed.\n  Visit: https://docs.docker.com/get-docker/"

# Support both `docker compose` (v2 plugin) and `docker-compose` (v1 standalone)
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  error "Docker Compose is not installed.\n  Visit: https://docs.docker.com/compose/install/"
fi

ok "Docker found"

# ── Set up install directory ──────────────────────────────────────────────────
INSTALL_DIR="${DRIFTCODE_DIR:-${HOME}/driftcode-server}"
info "Installing to: ${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}"
cd "${INSTALL_DIR}"

# ── Generate random password ──────────────────────────────────────────────────
if [ -f .env ] && grep -q "OPENCODE_SERVER_PASSWORD=" .env; then
  info ".env already exists — reusing existing password"
  # shellcheck disable=SC2046
  export $(grep -v '^#' .env | xargs)
else
  PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | head -c 32)
  cat > .env <<EOF
OPENCODE_SERVER_PASSWORD=${PASSWORD}
OPENCODE_SERVER_USERNAME=opencode
SERVER_PORT=4096
EOF
  ok "Generated server password"
fi

# ── Download docker-compose.yml ───────────────────────────────────────────────
COMPOSE_URL="https://raw.githubusercontent.com/driftcode/driftcode/main/docker/docker-compose.yml"
info "Downloading server configuration..."
curl -fsSL "${COMPOSE_URL}" -o docker-compose.yml \
  || error "Failed to download docker-compose.yml from:\n  ${COMPOSE_URL}"

# Create projects directory (persisted volume)
mkdir -p projects
ok "Project directory ready: ${INSTALL_DIR}/projects"

# ── Pull and start the container ──────────────────────────────────────────────
info "Pulling DriftCode server image..."
${COMPOSE_CMD} pull

info "Starting DriftCode server..."
${COMPOSE_CMD} up -d

# ── Wait for health endpoint ──────────────────────────────────────────────────
info "Waiting for server to become ready..."
PASS=$(grep OPENCODE_SERVER_PASSWORD .env | cut -d= -f2)
SERVER_URL="http://localhost:4096"
READY=false

for i in $(seq 1 30); do
  if curl -sf "${SERVER_URL}/global/health" \
       --user "opencode:${PASS}" \
       -o /dev/null 2>/dev/null; then
    READY=true
    break
  fi
  printf "."
  sleep 2
done
echo ""

if [ "${READY}" = false ]; then
  echo -e "${YELLOW}⚠  Server did not respond in 60s. Check logs:${NC}"
  echo "   cd ${INSTALL_DIR} && ${COMPOSE_CMD} logs -f"
  exit 1
fi

ok "Server is running"

# ── Detect public IP ──────────────────────────────────────────────────────────
PUBLIC_IP=$(curl -sf --max-time 5 https://ifconfig.me \
  || curl -sf --max-time 5 https://api.ipify.org \
  || hostname -I | awk '{print $1}')

# ── Print connection details ──────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}  CONNECT YOUR DRIFTCODE APP${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${BOLD}Server URL:${NC}  http://${PUBLIC_IP}:4096"
echo -e "  ${BOLD}Username:${NC}    opencode"
echo -e "  ${BOLD}Password:${NC}    ${PASS}"
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Credentials saved in: ${INSTALL_DIR}/.env"
echo ""
echo -e "${YELLOW}${BOLD}Next step: Connect an LLM provider${NC}"
echo ""
echo "SSH into this server and run opencode to connect a provider:"
echo "  opencode      # starts the TUI"
echo "  /connect      # choose a provider (GitHub Copilot, Claude, GPT-4, etc.)"
echo ""
echo "If you already pay for GitHub Copilot, DriftCode costs you nothing extra."
echo ""
