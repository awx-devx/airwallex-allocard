'use client'

import { useState } from 'react'
import type { FieldValues, UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import { isApiError } from '@/client/api/errors'
import { useUpdateCard } from '@/client/hooks/useCards'
import { useProjectMembers } from '@/client/hooks/useMembers'
import { permissionGateAllowed } from '@/client/lib/access'
import { manageCardDenialMessage } from '@/client/lib/cards'
import { applyServerErrorsFromApiError, useZodForm } from '@/client/lib/forms'
import { useCan } from '@/client/lib/permissions/useCan'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ErrorCode } from '@/shared/enums/errors'
import { Permission } from '@/shared/enums/permissions'

const accessFormSchema = z.object({
  accessList: z.array(z.string()),
})

function AccessListSheetBody({
  cardId,
  projectId,
  accessList,
  onClose,
}: {
  cardId: string
  projectId: string
  accessList: string[]
  onClose: () => void
}) {
  const members = useProjectMembers(projectId)
  const update = useUpdateCard()
  const { can, isLoading } = useCan(projectId)
  const allowed = permissionGateAllowed(can(Permission.CARD_MANAGE, { cardId }), isLoading)
  const form = useZodForm(accessFormSchema, { defaultValues: { accessList } })
  const selected = form.watch('accessList')
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  async function onSave() {
    setAlertMessage(null)
    try {
      await update.mutateAsync({ id: cardId, input: { accessList: selected } })
      onClose()
    } catch (error) {
      if (isApiError(error) && error.code === ErrorCode.VALIDATION_FAILED) {
        applyServerErrorsFromApiError(form as unknown as UseFormReturn<FieldValues>, error)
        return
      }
      setAlertMessage(isApiError(error) ? error.message : 'Unable to update access list')
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 px-4 pb-4">
      {alertMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{alertMessage}</AlertDescription>
        </Alert>
      ) : null}
      {members.isPending ? (
        <p className="text-sm text-muted-foreground">Loading members…</p>
      ) : (
        <div className="flex min-w-0 flex-col gap-2">
          {(members.data ?? []).map((member) => {
            const inputId = `access-${member.userId}`
            return (
              <div key={member.userId} className="flex items-center gap-2">
                <Checkbox
                  id={inputId}
                  checked={selected.includes(member.userId)}
                  onCheckedChange={(state) => {
                    const on = state === true
                    const next = on
                      ? selected.includes(member.userId)
                        ? selected
                        : [...selected, member.userId]
                      : selected.filter((id) => id !== member.userId)
                    form.setValue('accessList', next)
                  }}
                />
                <Label htmlFor={inputId} className="min-w-0 break-all font-normal">
                  {member.user.name} {member.user.email}
                </Label>
              </div>
            )
          })}
        </div>
      )}
      <PermissionGateView allowed={allowed} denialMessage={manageCardDenialMessage()}>
        <Button
          type="button"
          disabled={!allowed}
          loading={update.isPending}
          onClick={() => void onSave()}
        >
          Save access list
        </Button>
      </PermissionGateView>
    </div>
  )
}

export function AccessListSheet({
  cardId,
  projectId,
  accessList,
  open,
  onOpenChange,
}: {
  cardId: string
  projectId: string
  accessList: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="min-w-0 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit access</SheetTitle>
        </SheetHeader>
        {open ? (
          <AccessListSheetBody
            key={cardId}
            cardId={cardId}
            projectId={projectId}
            accessList={accessList}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
