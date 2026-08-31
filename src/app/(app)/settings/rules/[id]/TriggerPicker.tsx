'use client'

import {
  groupedTriggerEvents,
  optionalTimingSummary,
  parseIntInput,
  triggerDebounceHint,
  triggerEventLabel,
  triggerGroupSummary,
  triggerScheduleHint,
  triggerSectionHint,
} from '@/client/lib/rules'
import { FieldLabel, FormSection, OptionalBlock } from '@/app/(app)/settings/rules/[id]/FieldMeta'
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
    <FormSection title="2. When it runs" hint={triggerSectionHint()}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {groupedTriggerEvents().map((group) => {
          const selectedCount = group.events.filter((event) => events.includes(event)).length
          return (
            <OptionalBlock
              key={group.heading}
              summary={triggerGroupSummary(group.heading, selectedCount)}
              defaultOpen
            >
              <div className="flex min-w-0 flex-col gap-1.5">
                {group.events.map((event) => {
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
                        {triggerEventLabel(event)}
                      </Label>
                    </div>
                  )
                })}
              </div>
            </OptionalBlock>
          )
        })}
        <OptionalBlock summary={optionalTimingSummary()} defaultOpen className="md:col-span-2">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1">
              <FieldLabel htmlFor="trigger-schedule" hint={triggerScheduleHint()}>
                Schedule
              </FieldLabel>
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
              <FieldLabel htmlFor="trigger-debounce" hint={triggerDebounceHint()}>
                Debounce seconds
              </FieldLabel>
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
        </OptionalBlock>
      </div>
    </FormSection>
  )
}
