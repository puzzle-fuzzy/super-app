import * as React from 'react'
import { DayPicker } from 'react-day-picker'

import { cn } from '@/lib/utils'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col gap-4',
        month: 'flex flex-col gap-4',
        month_caption: 'flex justify-center pt-1 relative items-center w-full',
        caption_label: 'text-[13px] font-medium text-[#e5e5e5]',
        nav: 'flex items-center gap-1',
        button_previous: cn(
          'absolute left-1 h-7 w-7 rounded-md border border-transparent bg-transparent p-0',
          'text-[#999999] hover:bg-[#2a2a2a] hover:text-[#e5e5e5] transition-colors',
          'inline-flex items-center justify-center',
        ),
        button_next: cn(
          'absolute right-1 h-7 w-7 rounded-md border border-transparent bg-transparent p-0',
          'text-[#999999] hover:bg-[#2a2a2a] hover:text-[#e5e5e5] transition-colors',
          'inline-flex items-center justify-center',
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'text-[#666666] rounded-md w-8 font-normal text-[12px] h-8 inline-flex items-center justify-center',
        week: 'flex w-full mt-1',
        day: cn(
          'h-8 w-8 p-0 text-[13px] text-[#e5e5e5] font-normal',
          'rounded-md inline-flex items-center justify-center',
          'hover:bg-[#2a2a2a] transition-colors',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3a3a3a]',
        ),
        day_button: cn(
          'h-8 w-8 rounded-md inline-flex items-center justify-center text-[13px]',
          'hover:bg-[#2a2a2a] transition-colors',
        ),
        selected: cn(
          'bg-[#e5e5e5] text-[#141414] hover:bg-[#e5e5e5] hover:text-[#141414] font-medium',
        ),
        today: 'text-[#e5e5e5] font-medium border border-[#3a3a3a]',
        outside: 'text-[#555555] opacity-50',
        disabled: 'text-[#444444] opacity-40 pointer-events-none',
        range_middle: 'bg-[#2a2a2a] text-[#e5e5e5] rounded-none',
        hidden: 'invisible',
      }}
      {...props}
    />
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }
