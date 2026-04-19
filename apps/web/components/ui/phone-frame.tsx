import { cn } from '@/lib/utils'

interface PhoneFrameProps {
  className?: string
}

export function PhoneFrame({ className }: PhoneFrameProps) {
  return (
    <div
      className={cn(
        'relative mx-auto w-[280px] rounded-[2.5rem] border-2 border-border bg-surface shadow-2xl shadow-black/60',
        className,
      )}
    >
      {/* Notch */}
      <div className="absolute top-0 left-1/2 z-10 h-7 w-28 -translate-x-1/2 rounded-b-2xl bg-background" />

      {/* Screen */}
      <div className="overflow-hidden rounded-[2.4rem] pb-4 pt-10">
        {/* Status bar */}
        <div className="mb-3 flex items-center justify-between px-6">
          <span className="font-mono text-xs text-foreground">9:41</span>
          <div className="flex items-center gap-1">
            <div className="flex h-2 w-4 items-center rounded-sm border border-muted pr-0.5">
              <div className="h-full w-2/3 rounded-sm bg-muted" />
            </div>
          </div>
        </div>

        {/* App header */}
        <div className="mb-4 flex items-center justify-between px-4">
          <span className="font-mono text-sm font-semibold text-foreground">
            DriftCode
          </span>
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20">
            <div className="h-3 w-3 rounded-full bg-accent" />
          </div>
        </div>

        {/* Chat messages */}
        <div className="space-y-3 px-4 pb-4">
          {/* User message */}
          <div className="flex justify-end">
            <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-accent px-3 py-2">
              <p className="text-xs leading-relaxed text-white">
                Add a loading skeleton to the dashboard
              </p>
            </div>
          </div>

          {/* Assistant message with tool card */}
          <div className="flex justify-start">
            <div className="max-w-[80%] space-y-1.5 rounded-2xl rounded-tl-sm bg-border/40 px-3 py-2">
              <p className="text-xs leading-relaxed text-foreground">
                I&apos;ll add a loading skeleton component to your dashboard.
              </p>
              <div className="rounded-md border border-border/50 bg-background/60 px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-light" />
                  <span className="font-mono text-[10px] text-muted">
                    write_file
                  </span>
                </div>
                <p className="mt-0.5 truncate font-mono text-[10px] text-muted">
                  components/skeleton.tsx
                </p>
              </div>
            </div>
          </div>

          {/* Another user message */}
          <div className="flex justify-end">
            <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-accent px-3 py-2">
              <p className="text-xs text-white">Make it match the dark theme</p>
            </div>
          </div>

          {/* Typing indicator */}
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-tl-sm bg-border/40 px-3 py-2">
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-light" />
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-light [animation-delay:150ms]" />
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-light [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        </div>

        {/* Input bar */}
        <div className="border-t border-border/50 px-4 pt-2">
          <div className="flex items-center gap-2 rounded-2xl border border-border/50 bg-border/30 px-3 py-2">
            <span className="flex-1 font-mono text-xs text-muted">
              Message...
            </span>
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent">
              <div className="ml-0.5 h-0 w-0 border-b-[4px] border-t-[4px] border-l-[6px] border-b-transparent border-l-white border-t-transparent" />
            </div>
          </div>
        </div>
      </div>

      {/* Home indicator */}
      <div className="flex justify-center pb-2 pt-1">
        <div className="h-1 w-24 rounded-full bg-muted/40" />
      </div>
    </div>
  )
}
