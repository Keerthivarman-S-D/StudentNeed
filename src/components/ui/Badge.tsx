import * as React from "react"
import { cn } from "../../lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'teal' | 'warning' | 'destructive';
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-teal focus:ring-offset-2",
        {
          'border-transparent bg-brand-charcoal text-white': variant === 'default',
          'border-transparent bg-zinc-100 text-brand-charcoal': variant === 'secondary',
          'text-brand-charcoal border-brand-border bg-white': variant === 'outline',
          'border-brand-teal-border bg-brand-teal-light text-brand-teal-hover font-semibold': variant === 'success',
          'border-transparent bg-brand-teal text-white font-semibold': variant === 'teal',
          'border-amber-200 bg-amber-50 text-amber-800': variant === 'warning',
          'border-red-200 bg-red-50 text-red-800': variant === 'destructive',
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
