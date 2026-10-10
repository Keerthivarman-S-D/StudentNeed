import * as React from "react"
import { cn } from "../../lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'teal' | 'warning' | 'destructive';
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-teal focus:ring-offset-2 select-none",
        {
          'border-transparent bg-brand-charcoal text-white': variant === 'default',
          'border-zinc-200 bg-zinc-100 text-zinc-900': variant === 'secondary',
          'text-brand-charcoal border-brand-border bg-white': variant === 'outline',
          'border-emerald-300 bg-emerald-50 text-emerald-800 font-bold': variant === 'success',
          'border-transparent bg-brand-teal text-white font-bold': variant === 'teal',
          'border-amber-300 bg-amber-50 text-amber-900 font-semibold': variant === 'warning',
          'border-red-300 bg-red-50 text-red-800 font-semibold': variant === 'destructive',
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
