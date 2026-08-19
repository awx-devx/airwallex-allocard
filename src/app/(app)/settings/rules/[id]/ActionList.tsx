'use client'

import {
  allowDestructiveCloseMessage,
  parseCommaList,
  parseFormulaOrInt,
  parseIntInput,
} from '@/client/lib/rules'
import { FormulaHighlight } from '@/components/patterns/FormulaHighlight'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { AllowedTransactionCount } from '@/shared/enums/allowedTransactionCount'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { RuleActionType } from '@/shared/enums/ruleActionType'
import { RuleTargetSelect } from '@/shared/enums/ruleTargetSelect'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import type { RuleAction, RuleControlsParams } from '@/shared/types/rule'

const DEFAULT_ACTION: RuleAction = {
  action: RuleActionType.CARD_SET_CONTROLS,
  target: { select: RuleTargetSelect.PROJECT_CARDS },
  params: {},
}

function allowlistText(value: RuleControlsParams['allowedCurrencies']): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  return value.join(', ')
}

function parseAllowlist(raw: string): string[] | string | null {
  const trimmed = raw.trim()
  if (trimmed.length < 1) return null
  if (!trimmed.includes(',')) return trimmed
  return parseCommaList(trimmed)
}

function amountText(amount: string | number | undefined): string {
  if (amount === undefined) return ''
  return String(amount)
}

export type ActionListProps = {
  then: RuleAction[]
  onThenChange: (next: RuleAction[]) => void
  elseActions: RuleAction[] | undefined
  onElseChange: (next: RuleAction[] | undefined) => void
  cardOptions: { value: string; label: string }[]
  hasProjectScope: boolean
}

export function ActionList({
  then,
  onThenChange,
  elseActions,
  onElseChange,
  cardOptions,
  hasProjectScope,
}: ActionListProps) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ActionGroup
        heading="Then"
        actions={then}
        onChange={onThenChange}
        minCount={1}
        cardOptions={cardOptions}
        hasProjectScope={hasProjectScope}
      />
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">Otherwise</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onElseChange([...(elseActions ?? []), DEFAULT_ACTION])}
          >
            Add
          </Button>
        </div>
        {elseActions !== undefined && elseActions.length > 0 ? (
          <ActionGroup
            heading=""
            actions={elseActions}
            onChange={(next) => onElseChange(next.length > 0 ? next : undefined)}
            minCount={0}
            cardOptions={cardOptions}
            hasProjectScope={hasProjectScope}
          />
        ) : null}
      </div>
    </div>
  )
}

function ActionGroup({
  heading,
  actions,
  onChange,
  minCount,
  cardOptions,
  hasProjectScope,
}: {
  heading: string
  actions: RuleAction[]
  onChange: (next: RuleAction[]) => void
  minCount: number
  cardOptions: { value: string; label: string }[]
  hasProjectScope: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {heading ? <p className="text-sm font-medium">{heading}</p> : null}
      {actions.map((action, index) => (
        <ActionRow
          key={`${action.action}-${index}`}
          action={action}
          cardOptions={cardOptions}
          hasProjectScope={hasProjectScope}
          onChange={(next) => {
            const copy = actions.slice()
            copy[index] = next
            onChange(copy)
          }}
          onRemove={
            actions.length > minCount
              ? () => onChange(actions.filter((_, i) => i !== index))
              : undefined
          }
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...actions, DEFAULT_ACTION])}
      >
        Add action
      </Button>
    </div>
  )
}

function ActionRow({
  action,
  onChange,
  onRemove,
  cardOptions,
  hasProjectScope,
}: {
  action: RuleAction
  onChange: (next: RuleAction) => void
  onRemove?: () => void
  cardOptions: { value: string; label: string }[]
  hasProjectScope: boolean
}) {
  const params = action.params ?? {}
  const select = action.target.select

  function patchParams(patch: Partial<RuleControlsParams>) {
    onChange({ ...action, params: { ...params, ...patch } })
  }

  function patchTarget(patch: Partial<RuleAction['target']> & { select?: RuleTargetSelect }) {
    onChange({ ...action, target: { ...action.target, ...patch } })
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-md border border-border/80 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={action.action}
          onValueChange={(next) =>
            onChange({ ...action, action: next as RuleActionType, params: {} })
          }
        >
          <SelectTrigger aria-label="Action" size="sm" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(RuleActionType).map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={select}
          onValueChange={(next) =>
            patchTarget({ select: next as RuleTargetSelect, filter: undefined, cardId: undefined })
          }
        >
          <SelectTrigger aria-label="Target" size="sm" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(RuleTargetSelect).map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {onRemove ? (
          <Button type="button" variant="outline" size="sm" onClick={onRemove}>
            Remove
          </Button>
        ) : null}
      </div>
      {select === RuleTargetSelect.CARD ? (
        hasProjectScope ? (
          <Combobox
            options={cardOptions}
            value={action.target.cardId ?? null}
            onChange={(cardId) => patchTarget({ cardId: cardId ?? undefined })}
            placeholder="Card"
          />
        ) : (
          <Input
            value={action.target.cardId ?? ''}
            onChange={(event) => patchTarget({ cardId: event.target.value || undefined })}
            placeholder="Card id"
          />
        )
      ) : null}
      {select === RuleTargetSelect.PROJECT_CARDS ? (
        <Select
          value={
            action.target.filter &&
            'purpose' in action.target.filter &&
            action.target.filter.purpose
              ? action.target.filter.purpose
              : '__none__'
          }
          onValueChange={(value) =>
            patchTarget({
              filter: value === '__none__' ? undefined : { purpose: value as CardPurpose },
            })
          }
        >
          <SelectTrigger aria-label="Purpose" size="sm">
            <SelectValue placeholder="Any purpose" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Any purpose</SelectItem>
            {Object.values(CardPurpose).map((purpose) => (
              <SelectItem key={purpose} value={purpose}>
                {purpose}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {select === RuleTargetSelect.PROJECT_MEMBERS || select === RuleTargetSelect.MEMBER_CARDS ? (
        <div className="flex min-w-0 flex-col gap-1">
          <Label>Role keys</Label>
          <Input
            value={
              (action.target.filter && 'roleKeys' in action.target.filter
                ? action.target.filter.roleKeys
                : action.target.roleKeys
              )?.join(', ') ?? ''
            }
            onChange={(event) => {
              const roleKeys = parseCommaList(event.target.value) ?? undefined
              patchTarget({
                filter: roleKeys ? { roleKeys } : undefined,
                roleKeys,
              })
            }}
          />
        </div>
      ) : null}
      <ActionParams actionType={action.action} params={params} onChange={patchParams} />
    </div>
  )
}

function ActionParams({
  actionType,
  params,
  onChange,
}: {
  actionType: RuleActionType
  params: RuleControlsParams
  onChange: (patch: Partial<RuleControlsParams>) => void
}) {
  const limits = params.transactionLimits
  const showCreate = actionType === RuleActionType.CARD_CREATE
  const showControls = actionType === RuleActionType.CARD_SET_CONTROLS
  const showLimits = showCreate || showControls
  const showFreeze =
    actionType === RuleActionType.CARD_FREEZE || actionType === RuleActionType.CARD_UNFREEZE
  const showClose = actionType === RuleActionType.CARD_CLOSE
  const showNotify = actionType === RuleActionType.NOTIFY
  const showAccess =
    actionType === RuleActionType.ACCESS_GRANT ||
    actionType === RuleActionType.ACCESS_REVOKE ||
    actionType === RuleActionType.ACCESS_EXPIRE
  const showFlag = actionType === RuleActionType.FLAG_REVIEW
  const showReasonOnly =
    actionType === RuleActionType.BUDGET_ALLOCATE || actionType === RuleActionType.APPROVAL_REQUIRE

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {showCreate ? (
        <>
          <Select
            value={params.formFactor ?? '__none__'}
            onValueChange={(value) =>
              onChange({
                formFactor: value === '__none__' ? undefined : (value as 'VIRTUAL' | 'PHYSICAL'),
              })
            }
          >
            <SelectTrigger aria-label="Form factor" size="sm">
              <SelectValue placeholder="Form factor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Form factor</SelectItem>
              <SelectItem value="VIRTUAL">VIRTUAL</SelectItem>
              <SelectItem value="PHYSICAL">PHYSICAL</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={params.purpose ?? '__none__'}
            onValueChange={(value) =>
              onChange({ purpose: value === '__none__' ? undefined : (value as CardPurpose) })
            }
          >
            <SelectTrigger aria-label="Purpose" size="sm">
              <SelectValue placeholder="Purpose" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Purpose</SelectItem>
              {Object.values(CardPurpose).map((purpose) => (
                <SelectItem key={purpose} value={purpose}>
                  {purpose}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={params.allowedTransactionCount ?? '__none__'}
            onValueChange={(value) =>
              onChange({
                allowedTransactionCount:
                  value === '__none__' ? undefined : (value as AllowedTransactionCount),
              })
            }
          >
            <SelectTrigger aria-label="Transaction count" size="sm">
              <SelectValue placeholder="Transaction count" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Transaction count</SelectItem>
              <SelectItem value={AllowedTransactionCount.SINGLE}>SINGLE</SelectItem>
              <SelectItem value={AllowedTransactionCount.MULTIPLE}>MULTIPLE</SelectItem>
            </SelectContent>
          </Select>
        </>
      ) : null}
      {showLimits ? (
        <div className="flex min-w-0 flex-col gap-2">
          <Label>Currency</Label>
          <Input
            value={limits?.currency ?? ''}
            onChange={(event) =>
              onChange({
                transactionLimits: {
                  currency: event.target.value,
                  limits: limits?.limits ?? [
                    { interval: TransactionLimitInterval.MONTHLY, amount: '' },
                  ],
                },
              })
            }
          />
          {(limits?.limits ?? [{ interval: TransactionLimitInterval.MONTHLY, amount: '' }]).map(
            (entry, index) => (
              <div key={index} className="flex min-w-0 flex-col gap-2">
                <Select
                  value={entry.interval}
                  onValueChange={(interval) => {
                    const next = [...(limits?.limits ?? [])]
                    if (next.length === 0) {
                      next.push({
                        interval: interval as TransactionLimitInterval,
                        amount: entry.amount,
                      })
                    } else {
                      next[index] = {
                        ...entry,
                        interval: interval as TransactionLimitInterval,
                      }
                    }
                    onChange({
                      transactionLimits: {
                        currency: limits?.currency ?? '',
                        limits: next,
                      },
                    })
                  }}
                >
                  <SelectTrigger aria-label="Interval" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(TransactionLimitInterval).map((interval) => (
                      <SelectItem key={interval} value={interval}>
                        {interval}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={amountText(entry.amount)}
                  onChange={(event) => {
                    const amount = parseFormulaOrInt(event.target.value)
                    const next = [...(limits?.limits ?? [entry])]
                    next[index] = { ...entry, amount: amount === '' ? event.target.value : amount }
                    onChange({
                      transactionLimits: { currency: limits?.currency ?? '', limits: next },
                    })
                  }}
                />
                <FormulaHighlight expression={amountText(entry.amount)} />
              </div>
            ),
          )}
          <Label>Active from</Label>
          <Input
            value={params.activeFrom ?? ''}
            onChange={(event) => onChange({ activeFrom: event.target.value || null })}
          />
          <Label>Active to</Label>
          <Input
            value={params.activeTo ?? ''}
            onChange={(event) => onChange({ activeTo: event.target.value || null })}
          />
          <Label>Active to offset days</Label>
          <Input
            value={params.activeToOffsetDays === undefined ? '' : String(params.activeToOffsetDays)}
            onChange={(event) =>
              onChange({ activeToOffsetDays: parseIntInput(event.target.value) })
            }
          />
          {showCreate ? (
            <>
              <Label>Active from offset days</Label>
              <Input
                value={
                  params.activeFromOffsetDays === undefined
                    ? ''
                    : String(params.activeFromOffsetDays)
                }
                onChange={(event) =>
                  onChange({ activeFromOffsetDays: parseIntInput(event.target.value) })
                }
              />
            </>
          ) : null}
        </div>
      ) : null}
      {showControls ? (
        <div className="flex min-w-0 flex-col gap-2">
          <Label>Allowed currencies</Label>
          <Input
            value={allowlistText(params.allowedCurrencies)}
            onChange={(event) =>
              onChange({ allowedCurrencies: parseAllowlist(event.target.value) })
            }
          />
          <Label>Allowed merchant categories</Label>
          <Input
            value={allowlistText(params.allowedMerchantCategories)}
            onChange={(event) =>
              onChange({ allowedMerchantCategories: parseAllowlist(event.target.value) })
            }
          />
          <Label>Allowed merchant countries</Label>
          <Input
            value={allowlistText(params.allowedMerchantCountries)}
            onChange={(event) =>
              onChange({ allowedMerchantCountries: parseAllowlist(event.target.value) })
            }
          />
          <Label>Allowed merchant brands</Label>
          <Input
            value={allowlistText(params.allowedMerchantBrands)}
            onChange={(event) =>
              onChange({ allowedMerchantBrands: parseAllowlist(event.target.value) })
            }
          />
        </div>
      ) : null}
      {showFreeze || showReasonOnly || showFlag ? (
        <div className="flex min-w-0 flex-col gap-1">
          <Label>Reason</Label>
          <Input
            value={params.reason ?? ''}
            onChange={(event) => onChange({ reason: event.target.value || undefined })}
          />
        </div>
      ) : null}
      {showClose ? (
        <div className="flex min-w-0 flex-col gap-2">
          <Label>Reason</Label>
          <Input
            value={params.reason ?? ''}
            onChange={(event) => onChange({ reason: event.target.value || undefined })}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Checkbox
              id="allow-destructive"
              checked={params.allowDestructive === true}
              onCheckedChange={(checked) => onChange({ allowDestructive: checked === true })}
            />
            <Label htmlFor="allow-destructive" className="font-normal">
              allowDestructive
            </Label>
          </div>
          <p className="text-sm text-muted-foreground">{allowDestructiveCloseMessage()}</p>
        </div>
      ) : null}
      {showNotify ? (
        <div className="flex min-w-0 flex-col gap-1">
          <Label>Template</Label>
          <Input
            value={params.template ?? ''}
            onChange={(event) => onChange({ template: event.target.value || undefined })}
          />
        </div>
      ) : null}
      {showAccess ? (
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Switch
              id="recompute"
              checked={params.recompute === true}
              onCheckedChange={(checked) => onChange({ recompute: checked })}
            />
            <Label htmlFor="recompute" className="font-normal">
              recompute
            </Label>
          </div>
          <Label>Reason</Label>
          <Input
            value={params.reason ?? ''}
            onChange={(event) => onChange({ reason: event.target.value || undefined })}
          />
        </div>
      ) : null}
    </div>
  )
}
