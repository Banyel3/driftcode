# DriftCode

AI coding sessions from your phone. A self-hostable React Native client for [opencode](https://github.com/anomalyco/opencode).

---

## What it is

DriftCode is an open-source iOS/Android app that connects to your own opencode server running on a VPS. You get a full agentic coding experience — chat, file browsing, session management, GitHub integration — from anywhere, on any device.

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

## Self-hosting the server

The DriftCode app talks to a standard opencode server. Use the provided Docker setup to run one on any VPS.

### One-command install

```bash
curl -fsSL https://raw.githubusercontent.com/driftcode/driftcode/main/docker/install.sh | bash
```

This will:
1. Check for Docker and Docker Compose
2. Create `~/driftcode-server/` with a `docker-compose.yml` and `.env`
3. Generate a random server password
4. Pull and start the container
5. Print your server URL and credentials — paste them into the app

### Manual install

```bash
# 1. Clone or download the docker directory
git clone https://github.com/driftcode/driftcode.git
cd driftcode/docker

# 2. Create your .env
cp .env.example .env
# Edit .env — set OPENCODE_SERVER_PASSWORD to something strong

# 3. Start the server
docker compose up -d

# 4. Connect an LLM provider
#    SSH into your server and run:
opencode     # opens the TUI
# then: /connect — choose GitHub Copilot, Anthropic, OpenAI, etc.
```

### Connect from the app

Open DriftCode → tap **Connect to Server** → enter:

- **Server URL**: `http://<your-vps-ip>:4096`
- **Username**: `opencode` (default)
- **Password**: the value of `OPENCODE_SERVER_PASSWORD` from your `.env`

### Tip: HTTPS

Put nginx or Caddy in front of opencode for HTTPS. A sample nginx config with rate limiting (used by the DriftCode demo server) is in `docker/nginx.conf`.

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
