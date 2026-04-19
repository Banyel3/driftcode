import { Terminal, FolderGit2, Shield } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

const features: Feature[] = [
  {
    icon: Terminal,
    title: 'Agentic chat',
    description:
      'Full opencode sessions with streaming, tool calls, and file edits',
  },
  {
    icon: FolderGit2,
    title: 'Repo browser',
    description:
      'Browse GitHub repos, clone to your server, and open sessions in one tap',
  },
  {
    icon: Shield,
    title: 'Your infra',
    description: 'Your server, your data. No shared backend, no subscriptions',
  },
]

export function Features() {
  return (
    <section id="features" className="border-t border-border py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="space-y-4 rounded-xl border border-border bg-surface p-6 transition-colors hover:border-muted"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background">
                <feature.icon size={18} className="text-accent-light" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
