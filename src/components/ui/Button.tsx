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
          "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#204b39] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none",
          {
            'bg-[#204b39] text-white hover:bg-[#183a2c] shadow-xs motion-safe:active:scale-[0.98]': variant === 'default',
            'bg-zinc-100 text-[#252b27] hover:bg-zinc-200 motion-safe:active:scale-[0.98]': variant === 'secondary',
            'border border-[#dedcd4] bg-white text-[#252b27] hover:bg-[#edf1ec] hover:text-[#204b39] hover:border-[#204b39]/40 shadow-2xs motion-safe:active:scale-[0.98]': variant === 'outline',
            'hover:bg-zinc-100 text-[#555d56] hover:text-[#252b27]': variant === 'ghost',
            'bg-red-600 text-white hover:bg-red-700 shadow-xs motion-safe:active:scale-[0.98]': variant === 'destructive',
            'bg-[#252b27] text-white hover:bg-zinc-800 shadow-xs motion-safe:active:scale-[0.98]': variant === 'charcoal',
            'h-10 px-4 py-2': size === 'default',
            'h-9 rounded-lg px-3 text-xs': size === 'sm',
            'h-11 rounded-xl px-6 text-base': size === 'lg',
            'h-10 w-10 min-h-[40px] min-w-[40px] p-0': size === 'icon',
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
