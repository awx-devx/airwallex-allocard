'use client'

import { useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { useBudget } from '@/client/hooks/useBudget'
import { useProjectMembers, useRoles } from '@/client/hooks/useMembers'
import { useApprovalRules, usePutApprovalRules } from '@/client/hooks/useRequests'
import { useMe } from '@/client/hooks/useSession'
import { permissionGateAllowed } from '@/client/lib/access'
import { useCan } from '@/client/lib/permissions/useCan'
import {
  emptyApprovalRuleBody,
  noProjectRulesMessage,
  toApprovalRuleBody,
} from '@/client/lib/requests'
import { editControlsDenialMessage } from '@/client/lib/rules'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { currencyExponent } from '@/shared/constants/currency'
import { ApproverSelection } from '@/shared/enums/approverSelection'
import { Permission } from '@/shared/enums/permissions'
import { parseMoneyInput } from '@/lib/money'
import type { ApprovalRule, ApprovalRuleBody, ApproverSelector } from '@/shared/types/approvalRule'

type DraftRow = {
  thresholdRaw: string
  requiredCountRaw: string
  escalationRaw: string
  approverSelection: ApproverSelector
  escalateTo: ApproverSelector
}

function minorToInputString(amount: number, currency: string): string {
  const exp = currencyExponent(currency)
  if (exp === 0) {
    return String(amount)
  }
  const abs = Math.abs(amount)
  const factor = 10 ** exp
  const major = Math.trunc(abs / factor)
  const frac = abs % factor
  if (frac === 0) {
    return String(major)
  }
  return `${major}.${String(frac).padStart(exp, '0')}`
}

function parsePositiveInt(raw: string, min: number): number | null {
  const trimmed = raw.trim()
  if (!/^[0-9]+$/.test(trimmed)) {
    return null
  }
  const value = Number.parseInt(trimmed, 10)
  if (!Number.isInteger(value) || value < min) {
    return null
  }
  return value
}

function ruleToDraft(rule: ApprovalRule, currency: string): DraftRow {
  const body = toApprovalRuleBody(rule)
  return {
    thresholdRaw: minorToInputString(body.threshold, currency),
    requiredCountRaw: String(body.requiredCount),
    escalationRaw: String(body.escalationAfterMins),
    approverSelection: body.approverSelection,
    escalateTo: body.escalateTo,
  }
}

function emptyDraft(): DraftRow {
  const body = emptyApprovalRuleBody()
  return {
    thresholdRaw: '0',
    requiredCountRaw: String(body.requiredCount),
    escalationRaw: String(body.escalationAfterMins),
    approverSelection: body.approverSelection,
    escalateTo: body.escalateTo,
  }
}

function selectorOfType(type: ApproverSelection): ApproverSelector {
  if (type === ApproverSelection.ROLE) {
    return { type: ApproverSelection.ROLE, roleKey: '' }
  }
  if (type === ApproverSelection.NAMED_USERS) {
    return { type: ApproverSelection.NAMED_USERS, userIds: [] }
  }
  return { type: ApproverSelection.PROJECT_OWNER }
}

function selectorValid(sel: ApproverSelector): boolean {
  if (sel.type === ApproverSelection.NAMED_USERS) {
    return sel.userIds.length >= 1
  }
  if (sel.type === ApproverSelection.ROLE) {
    return sel.roleKey.length >= 1
  }
  return true
}

function SelectorFields({
  idPrefix,
  value,
  onChange,
  roleKeys,
  members,
}: {
  idPrefix: string
  value: ApproverSelector
  onChange: (next: ApproverSelector) => void
  roleKeys: ReadonlyArray<{ key: string; name: string }>
  members: ReadonlyArray<{ userId: string; user: { name: string } }>
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Select
        value={value.type}
        onValueChange={(type) => onChange(selectorOfType(type as ApproverSelection))}
      >
        <SelectTrigger aria-label={idPrefix}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ApproverSelection.ROLE}>Role</SelectItem>
          <SelectItem value={ApproverSelection.NAMED_USERS}>Named users</SelectItem>
          <SelectItem value={ApproverSelection.PROJECT_OWNER}>Project owner</SelectItem>
        </SelectContent>
      </Select>
      {value.type === ApproverSelection.ROLE ? (
        roleKeys.length > 0 ? (
          <Select
            value={value.roleKey.length >= 1 ? value.roleKey : undefined}
            onValueChange={(roleKey) => onChange({ type: ApproverSelection.ROLE, roleKey })}
          >
            <SelectTrigger aria-label={`${idPrefix} role`}>
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              {roleKeys.map((role) => (
                <SelectItem key={role.key} value={role.key}>
                  {role.name} ({role.key})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            maxLength={64}
            value={value.roleKey}
            onChange={(event) =>
              onChange({ type: ApproverSelection.ROLE, roleKey: event.target.value })
            }
            aria-label={`${idPrefix} role key`}
          />
        )
      ) : null}
      {value.type === ApproverSelection.NAMED_USERS ? (
        <ul className="flex min-w-0 flex-col gap-2">
          {members.map((member) => {
            const checked = value.userIds.includes(member.userId)
            return (
              <li key={member.userId} className="flex min-w-0 items-center gap-2">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(next) => {
                    const userIds = new Set(value.userIds)
                    if (next === true) {
                      userIds.add(member.userId)
                    } else {
                      userIds.delete(member.userId)
                    }
                    onChange({ type: ApproverSelection.NAMED_USERS, userIds: [...userIds] })
                  }}
                  aria-label={member.user.name}
                />
                <span className="min-w-0 break-words text-sm">{member.user.name}</span>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

export function ApprovalRuleEditor({ projectId }: { projectId: string }) {
  const query = useApprovalRules(projectId)
  const put = usePutApprovalRules()
  const budgetQuery = useBudget(projectId)
  const me = useMe()
  const roles = useRoles()
  const members = useProjectMembers(projectId)
  const { can, isLoading } = useCan(projectId)
  const allowed = permissionGateAllowed(can(Permission.CONTROL_EDIT), isLoading)
  const [touched, setTouched] = useState(false)
  const [draft, setDraft] = useState<DraftRow[]>([])
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const currency = budgetQuery.data?.budget?.currency ?? me.data?.activeOrg?.baseCurrency ?? ''

  if (query.isPending) {
    return <LoadingState rows={2} />
  }

  if (query.error) {
    return (
      <ErrorState
        message={isApiError(query.error) ? query.error.message : 'Unable to load approval rules'}
      />
    )
  }

  const rows = touched
    ? draft
    : query.data.map((rule) => ruleToDraft(rule, currency.length === 3 ? currency : 'USD'))

  function update(index: number, patch: Partial<DraftRow>) {
    setTouched(true)
    setDraft(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)))
  }

  function addRow() {
    setTouched(true)
    setDraft([...rows, emptyDraft()])
  }

  function removeRow(index: number) {
    setTouched(true)
    setDraft(rows.filter((_, rowIndex) => rowIndex !== index))
  }

  function parsedBodies(): ApprovalRuleBody[] | null {
    if (currency.length !== 3) return null
    const bodies: ApprovalRuleBody[] = []
    for (const row of rows) {
      let threshold: number
      try {
        threshold = parseMoneyInput(row.thresholdRaw, currency).amount
      } catch {
        return null
      }
      const requiredCount = parsePositiveInt(row.requiredCountRaw, 1)
      const escalationAfterMins = parsePositiveInt(row.escalationRaw, 1)
      if (requiredCount === null || escalationAfterMins === null) {
        return null
      }
      if (!selectorValid(row.approverSelection) || !selectorValid(row.escalateTo)) {
        return null
      }
      bodies.push(
        toApprovalRuleBody({
          threshold,
          requiredCount,
          escalationAfterMins,
          approverSelection: row.approverSelection,
          escalateTo: row.escalateTo,
        }),
      )
    }
    return bodies
  }

  const bodies = parsedBodies()
  const saveDisabled = !allowed || bodies === null || put.isPending

  async function onSave() {
    if (bodies === null) return
    setAlertMessage(null)
    try {
      await put.mutateAsync({ id: projectId, input: bodies })
      setTouched(false)
    } catch (error) {
      setAlertMessage(isApiError(error) ? error.message : 'Unable to save approval rules')
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {alertMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{alertMessage}</AlertDescription>
        </Alert>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{noProjectRulesMessage()}</p>
      ) : null}
      {rows.map((row, index) => (
        <div
          key={index}
          className="flex min-w-0 flex-col gap-3 rounded-md border border-border p-3"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <Label>Threshold ({currency || '—'})</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={row.thresholdRaw}
              onChange={(event) => update(index, { thresholdRaw: event.target.value })}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <Label>Required count</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={row.requiredCountRaw}
              onChange={(event) => update(index, { requiredCountRaw: event.target.value })}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <Label>Escalate after (minutes)</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={row.escalationRaw}
              onChange={(event) => update(index, { escalationRaw: event.target.value })}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <Label>Approvers</Label>
            <SelectorFields
              idPrefix={`approvers-${index}`}
              value={row.approverSelection}
              onChange={(approverSelection) => update(index, { approverSelection })}
              roleKeys={roles.data ?? []}
              members={members.data ?? []}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <Label>Escalate to</Label>
            <SelectorFields
              idPrefix={`escalate-${index}`}
              value={row.escalateTo}
              onChange={(escalateTo) => update(index, { escalateTo })}
              roleKeys={roles.data ?? []}
              members={members.data ?? []}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => removeRow(index)}>
              Remove
            </Button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={addRow}>
          Add
        </Button>
        <PermissionGateView allowed={allowed} denialMessage={editControlsDenialMessage()}>
          <Button
            type="button"
            disabled={saveDisabled}
            loading={put.isPending}
            onClick={() => void onSave()}
          >
            Save approval rules
          </Button>
        </PermissionGateView>
      </div>
    </div>
  )
}
