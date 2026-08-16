'use client'

import { RULE_TRIGGER_EVENTS, parseIntInput } from '@/client/lib/rules'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CreateRuleInput } from '@/shared/types/rule'

export type TriggerPickerProps = {
  value: CreateRuleInput['trigger']
  onChange: (next: CreateRuleInput['trigger']) => void
}

export function TriggerPicker({ value, onChange }: TriggerPickerProps) {
  const events = value.events ?? []

  function setEvents(nextEvents: string[]) {
    const next: CreateRuleInput['trigger'] = { ...value }
    if (nextEvents.length > 0) {
      next.events = nextEvents
    } else {
      delete next.events
    }
    onChange(next)
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-sm font-medium">Trigger</p>
      <div className="flex flex-col gap-2">
        {RULE_TRIGGER_EVENTS.map((event) => {
          const inputId = `trigger-event-${event}`
          return (
            <div key={event} className="flex items-center gap-2">
              <Checkbox
                id={inputId}
                checked={events.includes(event)}
                onCheckedChange={(checked) => {
                  if (checked === true) {
                    setEvents([...events, event])
                    return
                  }
                  setEvents(events.filter((item) => item !== event))
                }}
              />
              <Label htmlFor={inputId} className="font-normal">
                {event}
              </Label>
            </div>
          )
        })}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <Label htmlFor="trigger-schedule">Schedule</Label>
        <Input
          id="trigger-schedule"
          value={value.schedule ?? ''}
          maxLength={120}
          onChange={(event) => {
            const schedule = event.target.value
            const next: CreateRuleInput['trigger'] = { ...value }
            if (schedule.length > 0) {
              next.schedule = schedule
            } else {
              delete next.schedule
            }
            onChange(next)
          }}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <Label htmlFor="trigger-debounce">Debounce seconds</Label>
        <Input
          id="trigger-debounce"
          value={value.debounceSec === undefined ? '' : String(value.debounceSec)}
          onChange={(event) => {
            const debounceSec = parseIntInput(event.target.value)
            const next: CreateRuleInput['trigger'] = { ...value }
            if (debounceSec === undefined) {
              delete next.debounceSec
            } else {
              next.debounceSec = debounceSec
            }
            onChange(next)
          }}
        />
      </div>
    </div>
  )
}
