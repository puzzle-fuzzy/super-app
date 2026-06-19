import { useState, useEffect, useRef, useCallback } from 'react'
import { Check, ChevronDown } from 'lucide-react'

import { cn } from './cn'

export interface SelectOption<T extends string = string> {
  value: T
  label: string
  disabled?: boolean
}

interface SelectProps<T extends string = string> {
  options: readonly SelectOption<T>[]
  value: T
  onChange: (value: T) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function Select<T extends string = string>({
  options,
  value,
  onChange,
  placeholder = '请选择...',
  disabled = false,
  className,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})

  const selectedOption = options.find((opt) => opt.value === value)

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current || !menuRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const menuHeight = menuRef.current.offsetHeight
    const viewportHeight = window.innerHeight
    const gap = 6

    const spaceBelow = viewportHeight - triggerRect.bottom - gap
    const spaceAbove = triggerRect.top - gap

    // Flip upward when there isn't enough space below and there's more space above
    const flip = spaceBelow < menuHeight && spaceAbove > spaceBelow

    setMenuStyle({
      position: 'fixed',
      left: triggerRect.left,
      width: triggerRect.width,
      ...(flip
        ? { bottom: viewportHeight - triggerRect.top + gap }
        : { top: triggerRect.bottom + gap }),
    })
  }, [])

  useEffect(() => {
    if (!open) return

    // Wait a frame for the menu to render so we can measure it
    requestAnimationFrame(() => {
      updateMenuPosition()
    })

    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target
      if (target instanceof Element) {
        if (containerRef.current?.contains(target)) return
        if (menuRef.current?.contains(target)) return
      }
      setOpen(false)
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    function onScroll() {
      if (open) updateMenuPosition()
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, updateMenuPosition])

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          'flex w-full cursor-pointer items-center justify-between gap-2 rounded-[10px] border border-[#2a2a2a] bg-[#242424] px-3 py-[11px] text-left text-sm outline-none transition-colors',
          'focus:border-[#3a3a3a]',
          disabled && 'cursor-not-allowed opacity-45'
        )}
      >
        <span className={cn('truncate', selectedOption ? 'text-[#e5e5e5]' : 'text-[#666666]')}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown
          size={15}
          className={cn(
            'shrink-0 text-[#666666] transition-transform duration-150',
            open && 'rotate-180'
          )}
        />
      </button>
      <div
        ref={menuRef}
        role="listbox"
        style={menuStyle}
        className={cn(
          'z-[100] overflow-hidden rounded-[10px] border border-[#3a3a3a] bg-[#1d1d1d] p-1.5 shadow-[0_12px_32px_rgb(0_0_0_/_0.42)]',
          open ? 'block' : 'hidden'
        )}
      >
        {options.map((option) => {
          const isSelected = option.value === value

          return (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={isSelected}
              disabled={option.disabled}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
              className={cn(
                'flex h-9 w-full cursor-pointer items-center justify-between rounded-[7px] px-2.5 text-left text-[13px] font-medium text-[#999999] transition-colors hover:bg-[#2a2a2a] hover:text-[#e5e5e5] disabled:cursor-not-allowed disabled:opacity-45',
                isSelected && 'text-[#e5e5e5]'
              )}
            >
              {option.label}
              {isSelected && <Check size={15} className="shrink-0" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
