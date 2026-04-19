export function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <DriftIcon />
            <div>
              <p className="font-mono text-sm font-semibold text-foreground">
                DriftCode
              </p>
              <p className="font-mono text-xs text-muted">MIT License</p>
            </div>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/Banyel3/driftcode"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              GitHub
            </a>
            <a
              href="https://opencode.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              opencode.ai
            </a>
            <a
              href="https://github.com/Banyel3/driftcode/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              Releases
            </a>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6">
          <p className="font-mono text-xs text-muted">
            Not affiliated with or endorsed by the opencode team (anomalyco).
          </p>
        </div>
      </div>
    </footer>
  )
}

function DriftIcon() {
  return (
    <svg
      width="20"
      height="20"
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
