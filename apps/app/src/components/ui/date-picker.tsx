import * as React from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'

import { cn } from '@/lib/utils'
import { Calendar } from './calendar'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

interface DatePickerProps {
  value: Date | undefined
  onChange: (date: Date | undefined) => void
  placeholder?: string
  className?: string
}

function DatePicker({ value, onChange, placeholder, className }: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#242424] px-3 py-2 text-sm transition-colors',
            'hover:border-[#3a3a3a]',
            'focus:outline-none focus:border-[#3a3a3a]',
            !value && 'text-[#666666]',
            value && 'text-[#e5e5e5]',
            className,
          )}
        >
          <CalendarIcon size={14} className="shrink-0 text-[#666666]" />
          {value ? format(value, 'yyyy-MM-dd') : (placeholder ?? '选择日期...')}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
        />
      </PopoverContent>
    </Popover>
  )
}
DatePicker.displayName = 'DatePicker'

export { DatePicker }
