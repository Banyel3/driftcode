'use client'

import { useState } from 'react'
import { CodeBlock } from '@/components/ui/code-block'

type HostingMode = 'lan' | 'vps' | 'tunnel'

interface Step {
  title: string
  description?: string
  code?: string
  language?: string
  note?: string
}

interface Mode {
  id: HostingMode
  label: string
  title: string
  subtitle: string
  badge: string
  steps: Step[]
}

const modes: Mode[] = [
  {
    id: 'lan',
    label: 'LAN',
    title: 'Local Network',
    subtitle: 'Run opencode on your laptop or home server and connect over Wi-Fi.',
    badge: 'Best for: home use & local dev',
    steps: [
      {
        title: 'Install opencode',
        description: 'Install the opencode CLI globally via npm.',
        code: 'npm install -g opencode-ai',
      },
      {
        title: 'Start the server',
        description:
          'Bind opencode to all network interfaces so your phone can reach it.',
        code: 'opencode serve --hostname 0.0.0.0 --port 4096',
        note: 'Keep this terminal open — the server runs in the foreground.',
      },
      {
        title: 'Find your local IP address',
        description:
          'You need your machine\'s local IP to connect from your phone.',
        code: '# macOS / Linux\nifconfig | grep "inet " | grep -v 127.0.0.1\n\n# Windows\nipconfig | findstr "IPv4"',
        note: 'Your IP will look like 192.168.1.x or 10.0.0.x.',
      },
      {
        title: 'Connect DriftCode',
        description:
          'Open DriftCode on your phone. Tap "Connect server", enter your server URL, and tap Connect.',
        note: 'Server URL format: http://192.168.1.x:4096  (replace with your IP from step 3)',
      },
    ],
  },
  {
    id: 'vps',
    label: 'VPS',
    title: 'VPS — one command',
    subtitle:
      'Deploy to a Linux VPS for always-on access from anywhere. Works on ~$4/mo servers (Hetzner, Vultr, DigitalOcean).',
    badge: 'Best for: remote access anywhere',
    steps: [
      {
        title: 'Provision a VPS',
        description:
          'Spin up a fresh Ubuntu 22.04 LTS server. Any provider works — Hetzner CAX11 (~€3.29/mo), Vultr Cloud Compute, or DigitalOcean Droplet. 1 vCPU / 2 GB RAM is plenty.',
        note: 'Save the server\'s public IP — you\'ll need it in step 4.',
      },
      {
        title: 'SSH into your server',
        code: 'ssh root@YOUR_SERVER_IP',
      },
      {
        title: 'Run the install script',
        description:
          'One command installs Docker, pulls the opencode image, and starts the server with a systemd service.',
        code: 'curl -fsSL https://raw.githubusercontent.com/Banyel3/driftcode/main/docker/install.sh | bash',
        note: 'The script will prompt you to set a password — save it, you\'ll need it in DriftCode.',
      },
      {
        title: 'Open port 4096 (if needed)',
        description:
          'Most VPS providers block inbound ports by default. Allow port 4096 in your firewall.',
        code: '# UFW (Ubuntu default)\nufw allow 4096/tcp\nufw reload\n\n# Or use your provider\'s firewall dashboard (DigitalOcean / Hetzner Cloud)',
      },
      {
        title: 'Connect DriftCode',
        description:
          'Open DriftCode on your phone. Tap "Connect server" and enter your VPS details.',
        note: 'Server URL: http://YOUR_SERVER_IP:4096\nPassword: the one you set in step 3',
      },
    ],
  },
  {
    id: 'tunnel',
    label: 'Tunnel',
    title: 'Cloudflare Tunnel',
    subtitle:
      'No VPS, no port forwarding. Expose your local opencode server through a free Cloudflare URL — HTTPS included.',
    badge: 'Best for: zero cost, no infra',
    steps: [
      {
        title: 'Install opencode',
        description: 'Install the opencode CLI globally via npm.',
        code: 'npm install -g opencode-ai',
      },
      {
        title: 'Start opencode locally',
        description: 'Run opencode on your machine. It only needs to be reachable by localhost.',
        code: 'opencode serve --port 4096',
      },
      {
        title: 'Install cloudflared',
        description:
          'Install the Cloudflare tunnel client on the same machine running opencode.',
        code: '# macOS (Homebrew)\nbrew install cloudflared\n\n# Linux (Debian / Ubuntu)\ncurl -L https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg > /dev/null\necho \'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main\' | sudo tee /etc/apt/sources.list.d/cloudflared.list\nsudo apt update && sudo apt install cloudflared\n\n# Windows: download the installer from\n# https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/',
      },
      {
        title: 'Start the tunnel',
        description:
          'This creates a temporary public HTTPS URL that proxies to your local opencode server. No account needed.',
        code: 'cloudflared tunnel --url http://127.0.0.1:4096',
        note: 'cloudflared will print a URL like:\nhttps://random-words.trycloudflare.com\n\nCopy it — this is your server URL.',
      },
      {
        title: 'Connect DriftCode',
        description:
          'Open DriftCode on your phone. Tap "Connect server" and paste the tunnel URL.',
        note: 'The URL changes each time you restart the tunnel. For a permanent URL, use a named tunnel with a free Cloudflare account.',
      },
    ],
  },
]

export function SelfHost() {
  const [active, setActive] = useState<HostingMode>('lan')
  const mode = modes.find((m) => m.id === active)!

  return (
    <section id="self-host" className="border-t border-border py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10">
          <p className="mb-3 font-mono text-xs uppercase tracking-wider text-muted">
            Self-hosting
          </p>
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Own your setup
          </h2>
          <p className="max-w-xl text-base text-muted">
            Three ways to host opencode. Pick the one that fits your setup.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {/* Tabs */}
          <div className="flex border-b border-border">
            {modes.map((m) => (
              <button
                key={m.id}
                onClick={() => setActive(m.id)}
                className={`flex-1 py-3 font-mono text-sm font-medium transition-colors ${
                  active === m.id
                    ? 'border-b-2 border-accent-light bg-background/40 text-foreground'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Header */}
          <div className="border-b border-border px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground">{mode.title}</h3>
                <p className="max-w-xl text-sm leading-relaxed text-muted">
                  {mode.subtitle}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-border bg-background px-3 py-1 font-mono text-xs text-muted">
                {mode.badge}
              </span>
            </div>
          </div>

          {/* Steps */}
          <div className="divide-y divide-border">
            {mode.steps.map((step, index) => (
              <div key={index} className="flex gap-5 px-6 py-5">
                {/* Step number */}
                <div className="flex shrink-0 flex-col items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-accent/40 bg-accent/10 font-mono text-xs font-semibold text-accent-light">
                    {index + 1}
                  </div>
                  {index < mode.steps.length - 1 && (
                    <div className="w-px flex-1 bg-border" />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 space-y-3 pb-1">
                  <h4 className="text-sm font-semibold text-foreground">
                    {step.title}
                  </h4>
                  {step.description && (
                    <p className="text-sm leading-relaxed text-muted">
                      {step.description}
                    </p>
                  )}
                  {step.code && (
                    <CodeBlock
                      code={step.code}
                      language={step.language ?? 'bash'}
                    />
                  )}
                  {step.note && (
                    <div className="rounded-md border border-accent/20 bg-accent/5 px-3 py-2.5">
                      <p className="whitespace-pre-line font-mono text-xs leading-relaxed text-accent-light/80">
                        {step.note}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
