import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/70',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%]',
        'max-h-[90vh] overflow-hidden rounded-[14px] border border-[#3a3a3a] bg-[#1c1c1c]',
        'shadow-panel',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'duration-200',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className={cn(
          'absolute right-5 top-5 grid h-8 w-8 place-items-center rounded-lg',
          'text-[#999999] hover:bg-[#2a2a2a] hover:text-[#e5e5e5]',
          'transition-colors'
        )}
      >
        <X size={16} />
        <span className="sr-only">关闭</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('shrink-0 px-6 pt-6 pb-5', className)}
      {...props}
    />
  )
}
DialogHeader.displayName = 'DialogHeader'

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'shrink-0 flex flex-wrap justify-end gap-3 border-t border-[#2a2a2a] px-6 py-5',
        className
      )}
      {...props}
    />
  )
}
DialogFooter.displayName = 'DialogFooter'

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <DialogPrimitive.Title
      className={cn(
        'text-xl font-semibold leading-tight tracking-[-0.02em] text-[#e5e5e5]',
        className
      )}
      {...props}
    />
  )
}
DialogTitle.displayName = DialogPrimitive.Title.displayName

function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm leading-relaxed text-[#999999]', className)}
      {...props}
    />
  )
}
DialogDescription.displayName = DialogPrimitive.Description.displayName

function DialogKicker({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('m-0 text-[10px] font-black tracking-[0.15em] uppercase text-[#666666]', className)}
      {...props}
    />
  )
}
DialogKicker.displayName = 'DialogKicker'

function DialogBody({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('overflow-y-auto flex-1 min-h-0 px-6 py-0', className)}
      {...props}
    >
      {children}
    </div>
  )
}
DialogBody.displayName = 'DialogBody'

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogKicker,
  DialogBody,
}
