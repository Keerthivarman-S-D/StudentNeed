import * as React from "react"
import { cn } from "../../lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'charcoal';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
          {
            'bg-brand-teal text-white hover:bg-brand-teal-hover shadow-xs active:scale-[0.98]': variant === 'default',
            'bg-zinc-100 text-brand-charcoal hover:bg-zinc-200 active:scale-[0.98]': variant === 'secondary',
            'border border-brand-border bg-white text-brand-charcoal hover:bg-brand-teal-light hover:text-brand-teal-hover hover:border-brand-teal-border shadow-xs active:scale-[0.98]': variant === 'outline',
            'hover:bg-zinc-100 hover:text-brand-charcoal': variant === 'ghost',
            'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]': variant === 'destructive',
            'bg-brand-charcoal text-white hover:bg-zinc-800 active:scale-[0.98]': variant === 'charcoal',
            'h-10 px-4 py-2': size === 'default',
            'h-9 rounded-md px-3': size === 'sm',
            'h-11 rounded-md px-8 text-base font-semibold': size === 'lg',
            'h-10 w-10': size === 'icon',
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
