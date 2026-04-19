'use client'

import { motion } from 'framer-motion'
import { PhoneFrame } from '@/components/ui/phone-frame'

const ease = [0.22, 1, 0.36, 1] as const

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, ease, delay },
  }
}

export function Hero() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden pt-16">
      {/* Subtle dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'radial-gradient(circle, #58A6FF 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* Radial fade at bottom */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background to-transparent" />

      <div className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          {/* Left: copy */}
          <div className="space-y-8">
            <motion.div {...fadeUp(0.05)}>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                Open Source · MIT License
              </span>
            </motion.div>

            <motion.div className="space-y-4" {...fadeUp(0.12)}>
              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                AI coding sessions,
                <br />
                <span className="text-accent-light">from your phone.</span>
              </h1>
              <p className="max-w-lg text-lg leading-relaxed text-muted">
                DriftCode is a self-hostable mobile client for opencode. Connect
                your own server, browse your GitHub repos, and run full agentic
                coding sessions — anywhere.
              </p>
            </motion.div>

            <motion.div
              className="flex flex-col gap-3 sm:flex-row"
              {...fadeUp(0.2)}
            >
              <a
                href="https://github.com/Banyel3/driftcode/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/90"
              >
                Download for Android
              </a>
              <a
                href="#self-host"
                className="inline-flex items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:border-muted hover:bg-surface"
              >
                Self-host in 5 minutes
              </a>
            </motion.div>

            <motion.p className="font-mono text-xs text-muted" {...fadeUp(0.27)}>
              iOS coming soon · Open source · No subscription
            </motion.p>
          </div>

          {/* Right: phone mockup */}
          <motion.div
            className="flex justify-center lg:justify-end"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.18 }}
          >
            <PhoneFrame />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
