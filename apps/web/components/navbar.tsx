'use client'

import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Self-host', href: '#self-host' },
  { label: 'Providers', href: '#providers' },
  {
    label: 'GitHub',
    href: 'https://github.com/Banyel3/driftcode',
    external: true,
  },
] as const

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed left-0 right-0 top-0 z-50 transition-all duration-200',
        scrolled
          ? 'border-b border-border bg-background/80 backdrop-blur-md'
          : 'bg-transparent',
      )}
    >
      <nav className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2">
            <DriftIcon />
            <span className="font-mono text-base font-semibold tracking-tight text-foreground">
              DriftCode
            </span>
          </a>

          {/* Desktop nav */}
          <div className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target={'external' in link && link.external ? '_blank' : undefined}
                rel={'external' in link && link.external ? 'noopener noreferrer' : undefined}
                className="text-sm text-muted transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden items-center gap-3 md:flex">
            <a
              href="/download"
              className="rounded-md border border-accent px-4 py-1.5 text-sm font-medium text-accent-light transition-colors hover:bg-accent/10"
            >
              Download APK
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            className="p-1 text-muted transition-colors hover:text-foreground md:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-border bg-background/95 backdrop-blur-md md:hidden">
          <div className="mx-auto max-w-6xl space-y-1 px-4 py-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target={'external' in link && link.external ? '_blank' : undefined}
                rel={'external' in link && link.external ? 'noopener noreferrer' : undefined}
                className="block py-2.5 text-sm text-muted transition-colors hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="border-t border-border pt-3">
              <a
                href="/download"
                className="block rounded-md border border-accent px-4 py-2 text-center text-sm font-medium text-accent-light transition-colors hover:bg-accent/10"
                onClick={() => setOpen(false)}
              >
                Download APK
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

function DriftIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M4 8C4 8 7 6 12 6C17 6 20 8 20 8"
        stroke="#58A6FF"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4 12C4 12 7 10 12 10C17 10 20 12 20 12"
        stroke="#0066CC"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4 16C4 16 7 14 12 14C17 14 20 16 20 16"
        stroke="#58A6FF"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  )
}
