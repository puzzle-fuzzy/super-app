import * as React from 'react'

import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-lg border border-[#2a2a2a] bg-[#242424] px-3 py-2 text-sm text-[#e5e5e5] outline-none transition-colors',
          'placeholder:text-[#666666]',
          'focus:border-[#3a3a3a]',
          'disabled:cursor-not-allowed disabled:opacity-45',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
