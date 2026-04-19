interface Step {
  number: string
  title: string
  description: string
}

const steps: Step[] = [
  {
    number: '01',
    title: 'Spin up an opencode server',
    description: 'On a VPS, your laptop, or behind a Cloudflare Tunnel',
  },
  {
    number: '02',
    title: 'Connect DriftCode',
    description: 'Enter your server URL and password — done in under a minute',
  },
  {
    number: '03',
    title: 'Link GitHub (optional)',
    description:
      'Browse your repos, clone them to the server, pick a session',
  },
  {
    number: '04',
    title: 'Start coding',
    description: 'Full agentic AI sessions from your phone',
  },
]

export function HowItWorks() {
  return (
    <section className="border-t border-border py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-12">
          <p className="mb-3 font-mono text-xs uppercase tracking-wider text-muted">
            How it works
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Up and running in minutes
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div key={step.number} className="space-y-4">
              <span className="font-mono text-3xl font-bold leading-none text-accent-light/25">
                {step.number}
              </span>
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
