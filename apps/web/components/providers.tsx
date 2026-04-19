import { Badge } from '@/components/ui/badge'
import type { ComponentProps } from 'react'

type BadgeVariant = ComponentProps<typeof Badge>['variant']

interface Provider {
  label: string
  sublabel?: string
  variant: BadgeVariant
}

const providers: Provider[] = [
  {
    label: 'GitHub Copilot',
    sublabel: 'existing subscription',
    variant: 'green',
  },
  {
    label: 'ChatGPT Plus',
    sublabel: 'existing subscription',
    variant: 'green',
  },
  {
    label: 'GitLab Duo',
    sublabel: 'existing subscription',
    variant: 'green',
  },
  { label: 'Anthropic Claude', sublabel: 'API key', variant: 'blue' },
  { label: 'OpenAI', sublabel: 'API key', variant: 'blue' },
  { label: 'DeepSeek', sublabel: 'API key', variant: 'blue' },
  { label: 'OpenRouter', sublabel: 'API key', variant: 'blue' },
  { label: 'Ollama', sublabel: 'free / local', variant: 'gray' },
  { label: '+ 67 more providers', variant: 'gray' },
]

export function Providers() {
  return (
    <section id="providers" className="border-t border-border py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Use the models you already pay for
          </h2>
          <p className="max-w-2xl text-base leading-relaxed text-muted">
            opencode supports 75+ providers. If you already have GitHub Copilot,
            ChatGPT Plus, or GitLab Duo — DriftCode costs you nothing extra
            beyond a ~$4/mo VPS.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {providers.map((p) => (
            <Badge
              key={p.label}
              label={p.label}
              sublabel={p.sublabel}
              variant={p.variant}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
