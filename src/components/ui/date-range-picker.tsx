'use client'

import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { calendarDayToIso, isoToCalendarDate } from '@/components/ui/date-picker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatDate, formatRange } from '@/lib/dates'

export type DateRangePickerProps = {
  from: string | null
  to: string | null
  onChange: (next: { from: string | null; to: string | null }) => void
  disabled?: boolean
}

function rangeLabel(from: string | null, to: string | null): string | null {
  if (from && to) return formatRange(from, to)
  if (from) return formatDate(from)
  return null
}

function DateRangePicker({ from, to, onChange, disabled }: DateRangePickerProps) {
  const selected = {
    from: from ? isoToCalendarDate(from) : undefined,
    to: to ? isoToCalendarDate(to) : undefined,
  }
  const label = rangeLabel(from, to)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="h-9 w-full justify-start font-normal"
        >
          <CalendarIcon />
          {label ?? <span className="text-muted-foreground">Pick a date range</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={selected}
          onSelect={(range) =>
            onChange({
              from: range?.from ? calendarDayToIso(range.from) : null,
              to: range?.to ? calendarDayToIso(range.to) : null,
            })
          }
          disabled={disabled}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DateRangePicker }
