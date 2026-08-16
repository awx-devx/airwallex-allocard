'use client'

import { attributeOptions, conditionMode, parseConditionValue, wrapNot } from '@/client/lib/rules'
import { FormulaHighlight } from '@/components/patterns/FormulaHighlight'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ConditionOperator } from '@/shared/enums/conditionOperator'
import type { Condition, ConditionValue } from '@/shared/types/rule'

type UiMode = 'all' | 'any' | 'attr' | 'expr'

type Leaf = {
  attr: string
  op: ConditionOperator
  value: ConditionValue
}

const DEFAULT_LEAF: Leaf = {
  attr: 'project.status',
  op: ConditionOperator.EQ,
  value: 'ACTIVE',
}

const ARRAY_OPS: ReadonlySet<string> = new Set([
  ConditionOperator.IN,
  ConditionOperator.NIN,
  ConditionOperator.BETWEEN,
])

function isLeaf(condition: Condition): condition is Leaf {
  return condition.attr !== undefined && condition.op !== undefined && 'value' in condition
}

function isAttrRef(value: ConditionValue): value is { attr: string } {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'attr' in value
}

function innerCondition(when: Condition): Condition {
  return conditionMode(when) === 'not' ? wrapNot(when, false) : when
}

function leavesOf(inner: Condition): Leaf[] {
  const mode = conditionMode(inner)
  if (mode === 'all') {
    return (inner.all ?? []).filter(isLeaf)
  }
  if (mode === 'any') {
    return (inner.any ?? []).filter(isLeaf)
  }
  if (mode === 'attr' && isLeaf(inner)) {
    return [inner]
  }
  return [DEFAULT_LEAF]
}

function buildInner(mode: UiMode, inner: Condition, nextLeaves?: Leaf[]): Condition {
  const leaves = nextLeaves ?? leavesOf(inner)
  if (mode === 'all') {
    return { all: leaves.length > 0 ? leaves : [DEFAULT_LEAF] }
  }
  if (mode === 'any') {
    return { any: leaves.length > 0 ? leaves : [DEFAULT_LEAF] }
  }
  if (mode === 'expr') {
    return { expr: inner.expr ?? '' }
  }
  return leaves[0] ?? DEFAULT_LEAF
}

function literalFields(value: ConditionValue, op: ConditionOperator): string[] {
  if (isAttrRef(value)) {
    return op === ConditionOperator.BETWEEN ? ['', ''] : ['']
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => (item === null ? 'null' : String(item)))
    if (op === ConditionOperator.BETWEEN) {
      return [items[0] ?? '', items[1] ?? '']
    }
    return items.length >= 2 ? items : [...items, '']
  }
  if (op === ConditionOperator.BETWEEN) {
    return [value === null ? 'null' : String(value), '']
  }
  return [value === null ? 'null' : String(value)]
}

export type ConditionBuilderProps = {
  value: Condition
  onChange: (next: Condition) => void
  attributeKeys: ReadonlyArray<{ key: string; label: string }>
}

export function ConditionBuilder({ value, onChange, attributeKeys }: ConditionBuilderProps) {
  const options = attributeOptions(attributeKeys)
  const negated = conditionMode(value) === 'not'
  const inner = innerCondition(value)
  const mode: UiMode = conditionMode(inner) === 'not' ? 'attr' : (conditionMode(inner) as UiMode)
  const leaves = leavesOf(inner)

  function commit(nextInner: Condition, nextNegate = negated) {
    onChange(wrapNot(nextInner, nextNegate))
  }

  function setMode(nextMode: UiMode) {
    commit(buildInner(nextMode, inner))
  }

  function setLeaf(index: number, leaf: Leaf) {
    if (mode === 'attr') {
      commit(leaf)
      return
    }
    const next = leaves.slice()
    next[index] = leaf
    commit(buildInner(mode, inner, next))
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-sm font-medium">When</p>
      <RadioGroup
        className="flex flex-wrap gap-3"
        value={mode}
        onValueChange={(next) => setMode(next as UiMode)}
      >
        {(['all', 'any', 'attr', 'expr'] as const).map((item) => {
          const inputId = `condition-mode-${item}`
          return (
            <div key={item} className="flex items-center gap-2">
              <RadioGroupItem value={item} id={inputId} />
              <Label htmlFor={inputId} className="font-normal">
                {item}
              </Label>
            </div>
          )
        })}
      </RadioGroup>
      <div className="flex flex-wrap items-center gap-2">
        <Switch
          id="condition-negate"
          checked={negated}
          onCheckedChange={(checked) => commit(inner, checked)}
        />
        <Label htmlFor="condition-negate" className="font-normal">
          Negate entire condition
        </Label>
      </div>
      {mode === 'expr' ? (
        <div className="flex min-w-0 flex-col gap-2">
          <Textarea
            maxLength={500}
            value={inner.expr ?? ''}
            onChange={(event) => commit({ expr: event.target.value })}
          />
          <FormulaHighlight expression={inner.expr ?? ''} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {(mode === 'attr' ? leaves.slice(0, 1) : leaves).map((leaf, index) => (
            <LeafRow
              key={`${index}-${leaf.attr}-${leaf.op}`}
              leaf={leaf}
              options={options}
              onChange={(next) => setLeaf(index, next)}
              onRemove={
                mode !== 'attr' && leaves.length > 1
                  ? () =>
                      commit(
                        buildInner(
                          mode,
                          inner,
                          leaves.filter((_, i) => i !== index),
                        ),
                      )
                  : undefined
              }
            />
          ))}
          {mode !== 'attr' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => commit(buildInner(mode, inner, [...leaves, DEFAULT_LEAF]))}
            >
              Add condition
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}

function LeafRow({
  leaf,
  options,
  onChange,
  onRemove,
}: {
  leaf: Leaf
  options: { value: string; label: string }[]
  onChange: (next: Leaf) => void
  onRemove?: () => void
}) {
  const compareAttr = isAttrRef(leaf.value)
  const fields = literalFields(leaf.value, leaf.op)
  const arrayOp = ARRAY_OPS.has(leaf.op)

  function setLiteralAt(index: number, raw: string) {
    if (leaf.op === ConditionOperator.BETWEEN) {
      const next = [...fields]
      next[index] = raw
      onChange({
        ...leaf,
        value: [parseConditionValue(next[0] ?? ''), parseConditionValue(next[1] ?? '')],
      })
      return
    }
    if (arrayOp) {
      const next = fields.slice()
      next[index] = raw
      onChange({ ...leaf, value: next.map((item) => parseConditionValue(item)) })
      return
    }
    onChange({ ...leaf, value: parseConditionValue(raw) })
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <div className="min-w-0 flex-1">
          <Combobox
            options={options}
            value={leaf.attr}
            onChange={(value) => onChange({ ...leaf, attr: value ?? leaf.attr })}
            placeholder="Attribute"
          />
        </div>
        <Select
          value={leaf.op}
          onValueChange={(op) => {
            const nextOp = op as ConditionOperator
            const next: Leaf = { ...leaf, op: nextOp }
            if (ARRAY_OPS.has(nextOp)) {
              next.value =
                nextOp === ConditionOperator.BETWEEN
                  ? [parseConditionValue(fields[0] ?? ''), parseConditionValue(fields[1] ?? '')]
                  : fields.map((item) => parseConditionValue(item))
            } else if (compareAttr) {
              next.value = leaf.value
            } else {
              next.value = parseConditionValue(fields[0] ?? '')
            }
            onChange(next)
          }}
        >
          <SelectTrigger aria-label="Operator" size="sm" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(ConditionOperator).map((op) => (
              <SelectItem key={op} value={op}>
                {op}
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
      <div className="flex flex-wrap items-center gap-2">
        <Switch
          id={`compare-attr-${leaf.attr}-${leaf.op}`}
          checked={compareAttr}
          onCheckedChange={(checked) => {
            if (checked) {
              onChange({ ...leaf, value: { attr: isAttrRef(leaf.value) ? leaf.value.attr : '' } })
              return
            }
            onChange({ ...leaf, value: parseConditionValue(fields[0] ?? '') })
          }}
        />
        <Label htmlFor={`compare-attr-${leaf.attr}-${leaf.op}`} className="font-normal">
          Compare to attribute
        </Label>
      </div>
      {compareAttr ? (
        <Combobox
          options={options}
          value={isAttrRef(leaf.value) ? leaf.value.attr : null}
          onChange={(attr) => onChange({ ...leaf, value: { attr: attr ?? '' } })}
          placeholder="Attribute"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {fields.map((field, index) => (
            <Input
              key={index}
              value={field}
              onChange={(event) => setLiteralAt(index, event.target.value)}
            />
          ))}
          {leaf.op === ConditionOperator.IN || leaf.op === ConditionOperator.NIN ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...leaf,
                  value: [...fields, ''].map((item) => parseConditionValue(item)),
                })
              }
            >
              Add value
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}
