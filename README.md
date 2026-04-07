# DriftCode

AI coding sessions from your phone. A self-hostable React Native client for [opencode](https://github.com/anomalyco/opencode).

---

## What it is

DriftCode is an open-source iOS/Android app that connects to your own opencode server, whether it runs on your laptop (LAN), a VPS, or behind a tunnel. You get a full agentic coding experience — chat, file browsing, session management, GitHub integration — from anywhere, on any device.

No subscription. No shared backend. Your server, your data.

## Features

- **Chat** — full agentic coding sessions with tool-call cards, reasoning blocks, and streaming responses
- **Sessions** — browse, resume, and delete past sessions
- **Projects** — view server projects or browse/search your GitHub repos and clone them directly
- **Files** — browse the server file tree, view files with syntax highlighting, trigger AI actions (Explain, Refactor, Fix)
- **Settings** — manage your server connection, GitHub OAuth, AI model preference, and clone directory

## Stack

| Layer | Technology |
|---|---|
| App | React Native (Expo SDK 54, managed workflow) |
| Language | TypeScript (strict, no `any`) |
| Monorepo | Turborepo |
| State | Zustand v5 |
| Data fetching | TanStack Query v5 |
| Navigation | React Navigation v6 |
| Auth storage | Expo SecureStore |
| GitHub OAuth | Expo AuthSession (PKCE) |
| opencode API | fetch + SSE (custom client in `packages/opencode-client`) |
| GitHub API | Octokit (custom client in `packages/github-client`) |

## Monorepo structure

```
driftcode/
├── apps/
│   ├── mobile/          # React Native app (Expo)
│   └── web/             # Placeholder web app
├── packages/
│   ├── opencode-client/ # All opencode REST + SSE calls
│   └── github-client/   # All GitHub API calls (Octokit wrapper)
└── docker/              # Self-hosting Docker setup
```

## Hosting opencode for DriftCode

DriftCode works with a standard opencode server in multiple hosting modes:

| Mode | Best for | Server URL in app |
|---|---|---|
| Local network (LAN) | Home/office setup on same Wi-Fi/LAN | `http://<your-device-ip>:<port>` |
| Public deployment (VPS + domain) | Always-on remote access | `https://code.yourdomain.com` |
| Cloudflare Tunnel | Exposing local/private machine without opening router ports | `https://<tunnel-domain>` |

> [!IMPORTANT]
> The DriftCode demo server is only for trying the app (rate-limited, no persistence guarantees). For real work, run your own opencode server using one of the modes below.

### Mode A: Local network (same Wi-Fi/LAN)

If opencode is running on your laptop/PC in your local network, your phone can connect directly using that machine's IP + port.

1) Start opencode on a reachable interface and fixed port:

```bash
opencode serve --hostname 0.0.0.0 --port 4096
```

2) Find your machine IP on the LAN (example: `192.168.1.25`).

3) In DriftCode, connect with:
- **Server URL**: `http://192.168.1.25:4096`
- **Username**: usually `opencode` (or your configured username)
- **Password**: your opencode server password

Notes:
- Keep `http://` for LAN URLs. If you omit protocol, DriftCode assumes `https://`.
- Phone and host machine must be on the same network/VLAN.
- Ensure local firewall allows the chosen port.

### Mode B: Public deployment (VPS/domain)

Use the provided Docker setup when you want a remote always-on server.

#### One-command install

```bash
curl -fsSL https://raw.githubusercontent.com/driftcode/driftcode/main/docker/install.sh | bash
```

This script:
1. Checks Docker + Compose
2. Creates `~/driftcode-server/`
3. Generates credentials in `.env`
4. Starts the container
5. Prints connection details

#### Manual install

```bash
# 1. Get the docker files
git clone https://github.com/driftcode/driftcode.git
cd driftcode/docker

# 2. Create .env (adjust values)
cat > .env <<'EOF'
OPENCODE_SERVER_PASSWORD=change-this-to-a-strong-password
OPENCODE_SERVER_USERNAME=opencode
SERVER_PORT=4096
EOF

# 3. Start server
docker compose up -d
```

Then SSH into the host and connect an LLM provider:

```bash
opencode
# then run: /connect
```

For HTTPS, place nginx/Caddy in front of opencode. A sample nginx config with SSE/rate-limit handling is in `docker/nginx.conf`.

### Mode C: Cloudflare Tunnel (including local laptop/PC)

Use this when opencode runs on a private machine (even your local laptop/PC) and you want secure remote access without exposing inbound ports.

#### Quick temporary tunnel (fastest test)

1) Start opencode locally:

```bash
opencode serve --hostname 127.0.0.1 --port 4096
```

2) In another terminal, start a quick tunnel:

```bash
cloudflared tunnel --url http://127.0.0.1:4096
```

3) Copy the generated `https://...trycloudflare.com` URL into DriftCode as **Server URL**.

#### Stable tunnel with your own domain

```bash
cloudflared tunnel login
cloudflared tunnel create driftcode-opencode
cloudflared tunnel route dns driftcode-opencode code.yourdomain.com
```

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: driftcode-opencode
credentials-file: /home/<user>/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: code.yourdomain.com
    service: http://127.0.0.1:4096
  - service: http_status:404
```

Run tunnel:

```bash
cloudflared tunnel run driftcode-opencode
```

Use `https://code.yourdomain.com` in DriftCode.

### Switching between hosting modes

You can switch at any time in DriftCode via **Connect to Server** (or Settings -> Change Server).

Examples:
- LAN: `http://192.168.1.25:4096`
- Public VPS/domain: `https://code.yourdomain.com`
- Cloudflare tunnel: `https://<your-tunnel-hostname>`

## Running the app locally

```bash
# Prerequisites: Node 20+, npm, Expo Go on your phone (SDK 54)

# Install dependencies
npm install

# Start Metro bundler
cd apps/mobile
npx expo start

# Scan the QR code with Expo Go
```

## Architecture rules

- **All opencode API calls** must go through `packages/opencode-client`. Never call `fetch` directly from a component.
- **All GitHub API calls** must go through `packages/github-client`. Never import Octokit directly in the app.
- **Credentials** are stored only in Expo SecureStore. Never in plain AsyncStorage or component state.

## License

MIT — see [LICENSE](./LICENSE).

Not affiliated with the opencode team.
