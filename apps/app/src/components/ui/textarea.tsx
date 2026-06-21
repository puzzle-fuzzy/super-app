import * as React from 'react'
import { cn } from '@super-app/ui-react'

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[60px] w-full rounded-xl border border-[#2a2a2a] bg-[#242424] px-3 py-2 text-[13px] text-[#e5e5e5] placeholder:text-[#666666] outline-none transition-colors focus:border-[#3a3a3a] disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = 'Textarea'

export { Textarea }
