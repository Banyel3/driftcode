import type { Metadata } from 'next'
import { Download, Smartphone, ArrowRight } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'

export const metadata: Metadata = {
  title: 'Download DriftCode',
  description:
    'Download DriftCode for Android. iOS coming soon. Self-host opencode and run AI coding sessions from your phone.',
}

export default function DownloadPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pb-24 pt-32">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <div className="mb-12">
            <h1 className="mb-3 text-4xl font-bold tracking-tight text-foreground">
              Download DriftCode
            </h1>
            <p className="text-lg text-muted">
              Available for Android. iOS coming soon.
            </p>
          </div>

          <div className="space-y-4">
            {/* Android */}
            <div className="space-y-4 rounded-xl border border-border bg-surface p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background">
                    <Download size={18} className="text-accent-light" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">
                      Android APK
                    </h2>
                    <p className="text-sm text-muted">
                      Direct install via GitHub Releases
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-green-800/50 bg-green-950/50 px-2.5 py-1 font-mono text-xs text-green-400">
                  Available
                </span>
              </div>
              <p className="text-sm leading-relaxed text-muted">
                Download the latest APK from GitHub Releases. Enable &quot;Install
                from unknown sources&quot; in your Android settings, then tap the
                downloaded file to install.
              </p>
              <a
                href="https://github.com/Banyel3/driftcode/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90"
              >
                <Download size={14} />
                Download latest APK
                <ArrowRight size={14} />
              </a>
            </div>

            {/* iOS */}
            <div className="space-y-4 rounded-xl border border-border bg-surface p-6 opacity-60">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background">
                    <Smartphone size={18} className="text-muted" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">iOS</h2>
                    <p className="text-sm text-muted">TestFlight beta planned</p>
                  </div>
                </div>
                <span className="rounded-full border border-border bg-surface px-2.5 py-1 font-mono text-xs text-muted">
                  Coming soon
                </span>
              </div>
              <p className="text-sm leading-relaxed text-muted">
                iOS support is in the works via TestFlight beta. Star the repo
                on GitHub to be notified when it launches.
              </p>
              <a
                href="https://github.com/Banyel3/driftcode"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm font-medium text-muted transition-colors hover:border-muted hover:text-foreground"
              >
                Watch on GitHub for updates
              </a>
            </div>

            {/* Need a server */}
            <div className="space-y-3 rounded-xl border border-border bg-surface p-6">
              <h2 className="font-semibold text-foreground">
                Need a server too?
              </h2>
              <p className="text-sm leading-relaxed text-muted">
                DriftCode connects to your own opencode server. Set one up in
                minutes on a VPS, your laptop, or via Cloudflare Tunnel.
              </p>
              <a
                href="/#self-host"
                className="inline-flex items-center gap-1.5 text-sm text-accent-light hover:underline"
              >
                Self-host in 5 minutes <ArrowRight size={14} />
              </a>
            </div>

            {/* Dev build */}
            <div className="space-y-3 rounded-xl border border-border bg-surface/50 p-6">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  Development build
                </h2>
                <span className="rounded-full border border-border bg-surface px-2 py-0.5 font-mono text-xs text-muted">
                  Dev
                </span>
              </div>
              <p className="text-sm leading-relaxed text-muted">
                Developers can run DriftCode in Expo Go for testing. Clone the
                repo and run{' '}
                <code className="rounded bg-background/60 px-1.5 py-0.5 font-mono text-xs text-accent-light">
                  npm run mobile
                </code>{' '}
                from the monorepo root.
              </p>
              <p className="font-mono text-xs text-muted">
                Expo Go dev build QR code — coming soon
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
