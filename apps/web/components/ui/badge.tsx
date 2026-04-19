import { cn } from '@/lib/utils'

type BadgeVariant = 'green' | 'blue' | 'gray'

interface BadgeProps {
  label: string
  sublabel?: string
  variant: BadgeVariant
}

const variantStyles: Record<BadgeVariant, string> = {
  green: 'bg-green-950/50 text-green-400 border-green-800/50',
  blue: 'bg-blue-950/50 text-accent-light border-accent/30',
  gray: 'bg-surface text-muted border-border',
}

export function Badge({ label, sublabel, variant }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-sm font-medium',
        variantStyles[variant],
      )}
    >
      <span>{label}</span>
      {sublabel && (
        <span className="text-xs font-normal opacity-70">{sublabel}</span>
      )}
    </span>
  )
}
