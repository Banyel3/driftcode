import { Github } from 'lucide-react'

export function GithubCta() {
  return (
    <section className="border-t border-border py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="space-y-6 rounded-xl border border-border bg-surface p-8 text-center sm:p-12">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
            DriftCode is open source. Star it, fork it, contribute.
          </h2>
          <div>
            <a
              href="https://github.com/Banyel3/driftcode"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-6 py-3 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
            >
              <Github size={16} />
              View on GitHub
            </a>
          </div>
          <p className="font-mono text-xs text-muted">
            MIT License · Not affiliated with the opencode team
          </p>
        </div>
      </div>
    </section>
  )
}
