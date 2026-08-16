'use client'

import { useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { useAttributeValues, useSetAttributeValue } from '@/client/hooks/useRules'
import { ingestNotOnThisScreenMessage, parseConditionValue } from '@/client/lib/rules'
import { AttributeValue } from '@/components/patterns/AttributeValue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AttributeSource } from '@/shared/enums/attributeSource'
import { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
import type { AttributeDefinition } from '@/shared/types/attribute'

export function AttributeValueSheet({
  definition,
  open,
  onOpenChange,
}: {
  definition: AttributeDefinition | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="min-w-0 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{definition?.key ?? 'Values'}</SheetTitle>
        </SheetHeader>
        {open && definition ? <AttributeValueSheetBody definition={definition} /> : null}
      </SheetContent>
    </Sheet>
  )
}

function AttributeValueSheetBody({ definition }: { definition: AttributeDefinition }) {
  const values = useAttributeValues({ key: definition.key, page: 1, pageSize: 100 })
  const saveValue = useSetAttributeValue()
  const [subjectType, setSubjectType] = useState<AttributeSubjectType>(AttributeSubjectType.PROJECT)
  const [subjectId, setSubjectId] = useState('')
  const [raw, setRaw] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {(values.data?.items ?? []).map((item) => (
        <AttributeValue
          key={item.id}
          value={item.value}
          observedAt={item.observedAt}
          ttlSec={item.ttlSec}
          label={`${item.subjectType} ${item.subjectId}`}
        />
      ))}
      {definition.source === AttributeSource.MANUAL ? (
        <div className="flex min-w-0 flex-col gap-2">
          <Select
            value={subjectType}
            onValueChange={(value) => setSubjectType(value as AttributeSubjectType)}
          >
            <SelectTrigger aria-label="Subject type" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(AttributeSubjectType).map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label htmlFor="attr-subject">Subject id</Label>
          <Input
            id="attr-subject"
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
          />
          <Label htmlFor="attr-value">Value</Label>
          <Input id="attr-value" value={raw} onChange={(event) => setRaw(event.target.value)} />
          {message ? <p className="text-sm text-destructive">{message}</p> : null}
          <Button
            type="button"
            disabled={subjectId.length < 1}
            loading={saveValue.isPending}
            onClick={() => {
              setMessage(null)
              void saveValue
                .mutateAsync({
                  key: definition.key,
                  subjectType,
                  subjectId,
                  value: parseConditionValue(raw),
                })
                .catch((error: unknown) => {
                  setMessage(isApiError(error) ? error.message : 'Unable to save value')
                })
            }}
          >
            Save value
          </Button>
        </div>
      ) : null}
      {definition.source === AttributeSource.WEBHOOK ? (
        <p className="text-sm text-muted-foreground">{ingestNotOnThisScreenMessage()}</p>
      ) : null}
      {definition.source === AttributeSource.CONNECTOR ? (
        <p className="text-sm text-muted-foreground">
          Values refresh every {definition.refreshIntervalSec ?? '—'} seconds.
        </p>
      ) : null}
    </div>
  )
}
