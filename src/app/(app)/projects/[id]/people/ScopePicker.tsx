'use client'

import { buildAccessScope, SCOPE_LEVEL_LABELS } from '@/client/lib/access'
import { useBudgetCategories } from '@/client/hooks/useBudget'
import { useProjectCards } from '@/client/hooks/useCards'
import { useWorkstreams } from '@/client/hooks/useProjects'
import { LoadingState } from '@/components/patterns/LoadingState'
import { Checkbox } from '@/components/ui/checkbox'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import type { AccessScope } from '@/shared/types/accessScope'

export type ScopePickerProps = {
  projectId: string
  value: AccessScope
  onChange: (next: AccessScope) => void
  members?: { userId: string; user: { name: string } }[]
  excludeUserId?: string
  /** When false, the caller renders Active between elsewhere. */
  showValidity?: boolean
}

function toggleId(ids: string[] | undefined, id: string, checked: boolean): string[] {
  const next = new Set(ids ?? [])
  if (checked) {
    next.add(id)
  } else {
    next.delete(id)
  }
  return [...next]
}

function IdChecklist({
  items,
  selected,
  onToggle,
  empty,
}: {
  items: { id: string; label: string }[]
  selected: string[]
  onToggle: (id: string, checked: boolean) => void
  empty: string
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const inputId = `scope-id-${item.id}`
        return (
          <div key={item.id} className="flex items-center gap-2">
            <Checkbox
              id={inputId}
              checked={selected.includes(item.id)}
              onCheckedChange={(state) => onToggle(item.id, state === true)}
            />
            <Label htmlFor={inputId} className="min-w-0 break-all font-normal">
              {item.label}
            </Label>
          </div>
        )
      })}
    </div>
  )
}

export function ScopePicker({
  projectId,
  value,
  onChange,
  members = [],
  excludeUserId,
  showValidity = true,
}: ScopePickerProps) {
  const workstreams = useWorkstreams(projectId)
  const categories = useBudgetCategories(projectId)
  const cards = useProjectCards(projectId, { page: 1, pageSize: 100 })

  function patchIds(patch: {
    workstreamIds?: string[]
    categoryIds?: string[]
    cardIds?: string[]
    memberIds?: string[]
  }) {
    onChange(
      buildAccessScope({
        level: value.level,
        workstreamIds: patch.workstreamIds ?? value.workstreamIds,
        categoryIds: patch.categoryIds ?? value.categoryIds,
        cardIds: patch.cardIds ?? value.cardIds,
        memberIds: patch.memberIds ?? value.memberIds,
        validFrom: value.validFrom,
        validTo: value.validTo,
      }),
    )
  }

  const assignedMembers = members.filter((member) => member.userId !== excludeUserId)

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <RadioGroup
        className="flex flex-wrap gap-x-4 gap-y-2"
        value={value.level}
        onValueChange={(level) =>
          onChange(
            buildAccessScope({
              level: level as AccessScopeLevel,
              validFrom: value.validFrom,
              validTo: value.validTo,
            }),
          )
        }
      >
        {Object.values(AccessScopeLevel).map((level) => {
          const inputId = `scope-level-${level}`
          return (
            <div key={level} className="flex items-center gap-2">
              <RadioGroupItem value={level} id={inputId} />
              <Label htmlFor={inputId} className="font-normal">
                {SCOPE_LEVEL_LABELS[level]}
              </Label>
            </div>
          )
        })}
      </RadioGroup>

      {value.level === AccessScopeLevel.WORKSTREAM ? (
        workstreams.isPending ? (
          <LoadingState rows={2} />
        ) : (
          <IdChecklist
            items={(workstreams.data ?? []).map((row) => ({ id: row.id, label: row.name }))}
            selected={value.workstreamIds ?? []}
            onToggle={(id, checked) =>
              patchIds({ workstreamIds: toggleId(value.workstreamIds, id, checked) })
            }
            empty="No workstreams yet."
          />
        )
      ) : null}

      {value.level === AccessScopeLevel.CATEGORY ? (
        categories.isPending ? (
          <LoadingState rows={2} />
        ) : (
          <IdChecklist
            items={(categories.data ?? []).map((row) => ({ id: row.id, label: row.name }))}
            selected={value.categoryIds ?? []}
            onToggle={(id, checked) =>
              patchIds({ categoryIds: toggleId(value.categoryIds, id, checked) })
            }
            empty="No categories yet."
          />
        )
      ) : null}

      {value.level === AccessScopeLevel.CARD ? (
        cards.isPending ? (
          <LoadingState rows={2} />
        ) : (
          <IdChecklist
            items={(cards.data?.items ?? []).map((row) => ({
              id: row.id,
              label: `${row.nickName} ${row.maskedNumber}`,
            }))}
            selected={value.cardIds ?? []}
            onToggle={(id, checked) => patchIds({ cardIds: toggleId(value.cardIds, id, checked) })}
            empty="No cards yet."
          />
        )
      ) : null}

      {value.level === AccessScopeLevel.OWN ? (
        <p className="text-sm text-muted-foreground">Only their own transactions and cards.</p>
      ) : null}

      {value.level === AccessScopeLevel.ASSIGNED_MEMBERS ? (
        <IdChecklist
          items={assignedMembers.map((row) => ({ id: row.userId, label: row.user.name }))}
          selected={value.memberIds ?? []}
          onToggle={(id, checked) =>
            patchIds({ memberIds: toggleId(value.memberIds, id, checked) })
          }
          empty="No members yet."
        />
      ) : null}

      {showValidity ? (
        <div className="flex min-w-0 flex-col gap-2">
          <Label>Active between (optional)</Label>
          <DateRangePicker
            from={value.validFrom ?? null}
            to={value.validTo ?? null}
            onChange={({ from, to }) =>
              onChange(
                buildAccessScope({
                  level: value.level,
                  workstreamIds: value.workstreamIds,
                  categoryIds: value.categoryIds,
                  cardIds: value.cardIds,
                  memberIds: value.memberIds,
                  validFrom: from,
                  validTo: to,
                }),
              )
            }
          />
        </div>
      ) : null}
    </div>
  )
}
