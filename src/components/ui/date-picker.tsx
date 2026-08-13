'use client'

import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatDate } from '@/lib/dates'

/** Calendar day → ISO 8601 at UTC midnight (`YYYY-MM-DDT00:00:00.000Z`). */
export function calendarDayToIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}T00:00:00.000Z`
}

export function isoToCalendarDate(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)
}

export type DatePickerProps = {
  value: string | null
  onChange: (iso: string | null) => void
  disabled?: boolean
  placeholder?: string
}

function DatePicker({ value, onChange, disabled, placeholder = 'Pick a date' }: DatePickerProps) {
  const selected = value ? isoToCalendarDate(value) : undefined

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="w-full justify-start font-normal"
        >
          <CalendarIcon />
          {value ? formatDate(value) : <span className="text-muted-foreground">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => onChange(date ? calendarDayToIso(date) : null)}
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
