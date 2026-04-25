# Contributing to DriftCode

DriftCode is a self-hostable React Native app (iOS/Android) that connects to your own [opencode](https://github.com/anomalyco/opencode) server — enabling agentic coding from your phone. Contributions welcome.

## Getting Started

**Prerequisites:**
- Node.js 18+
- npm 9+
- For mobile: Expo Go (SDK 54) on your device or a simulator

```bash
git clone https://github.com/your-org/driftcode.git
cd driftcode
npm install
```

**Run workspaces:**
```bash
npm run mobile        # Expo / Metro bundler
npm run web           # Next.js dev server (landing page)
npm run dev           # All workspaces
```

**Type-check:**
```bash
npm run type-check                    # All packages
cd apps/mobile && npx tsc --noEmit   # Mobile only
```

## Project Structure

```
apps/mobile/               # @driftcode/mobile — React Native (Expo SDK 54)
apps/web/                  # @driftcode/web — Next.js 15 marketing page
packages/opencode-client/  # @driftcode/opencode-client — opencode REST + SSE
packages/github-client/    # @driftcode/github-client — GitHub API (Octokit)
docker/                    # Self-hosting Docker setup
```

## Architecture Rules

These rules are non-negotiable. PRs that violate them will not be merged.

1. **All opencode API calls** must go through `packages/opencode-client`. No direct `fetch` against the opencode server from app code.
2. **All GitHub API calls** must go through `packages/github-client`. No direct Octokit imports in the mobile app.
3. **Credentials** are stored only in Expo SecureStore — never in AsyncStorage, component state, or plain storage.
4. **GitHub token** is never sent to the opencode server. It is used client-side only via `github-client`.

## How to Contribute

### Reporting Bugs

Open a [GitHub Issue](../../issues/new) with:
- Steps to reproduce
- Expected vs actual behavior
- Device/OS/Expo SDK version
- opencode server version (if relevant)

### Suggesting Features

Open a [GitHub Issue](../../issues/new) with the `enhancement` label. Describe the use case — what problem does it solve?

### Submitting a Pull Request

1. Fork the repo and create a branch: `git checkout -b feat/your-feature` or `fix/your-bug`
2. Make your changes following the code style below
3. Run lint and type-check: `npm run lint && npm run type-check`
4. Open a PR against `main` with a clear description of what and why

## Code Style

- **TypeScript strict mode** across all packages. `any` is not allowed.
- Comments only when the **why** is non-obvious (a hidden constraint, a workaround, a subtle invariant). No comments describing what the code does.
- No unused variables, imports, or dead code.
- Keep changes focused — one concern per PR.

## Self-Hosting Context

DriftCode requires a running opencode server. When testing features that interact with the server, run opencode locally or via Docker (`docker/`). The app connects via the server URL configured in Settings.

## Questions?

Open an issue or start a Discussion on GitHub.
