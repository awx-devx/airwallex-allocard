'use client'

import { useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { useUpdateOrgMember } from '@/client/hooks/useOrganizations'
import {
  isLastOrgOwner,
  lastOrgOwnerDenialMessage,
  manageOrgMemberDenialMessage,
  ORG_ROLE_LABELS,
} from '@/client/lib/access'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { MembershipStatus } from '@/shared/enums/membershipStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import type { MembershipWithUser } from '@/shared/types/membership'

function EditOrgMemberSheetBody({
  orgId,
  member,
  members,
  canManage,
  onClose,
  onError,
}: {
  orgId: string
  member: MembershipWithUser
  members: MembershipWithUser[]
  canManage: boolean
  onClose: () => void
  onError: (message: string) => void
}) {
  const updateMember = useUpdateOrgMember()
  const [orgRole, setOrgRole] = useState<OrgRole>(member.orgRole)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const lastOwner = isLastOrgOwner(members, member.userId)
  const roleChanged = orgRole !== member.orgRole
  const suspended = member.status === MembershipStatus.SUSPENDED

  async function onSave() {
    if (!roleChanged || lastOwner) {
      return
    }
    setAlertMessage(null)
    try {
      await updateMember.mutateAsync({
        id: orgId,
        userId: member.userId,
        input: { orgRole },
      })
      onClose()
    } catch (error) {
      const message = isApiError(error) ? error.message : 'Unable to update member'
      setAlertMessage(message)
      onError(message)
    }
  }

  async function onToggleStatus() {
    if (lastOwner && !suspended) {
      return
    }
    setAlertMessage(null)
    try {
      await updateMember.mutateAsync({
        id: orgId,
        userId: member.userId,
        input: {
          status: suspended ? MembershipStatus.ACTIVE : MembershipStatus.SUSPENDED,
        },
      })
      onClose()
    } catch (error) {
      const message = isApiError(error) ? error.message : 'Unable to update member'
      setAlertMessage(message)
      onError(message)
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {alertMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{alertMessage}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex min-w-0 flex-col">
        <span className="min-w-0 break-all font-medium">{member.user.name}</span>
        <span className="text-sm text-muted-foreground">{member.user.email}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="edit-org-member-role">Organisation role</Label>
        {lastOwner ? (
          <PermissionGateView allowed={false} denialMessage={lastOrgOwnerDenialMessage()}>
            <Select value={orgRole} onValueChange={() => undefined} disabled>
              <SelectTrigger
                id="edit-org-member-role"
                className="w-full"
                aria-label="Organisation role"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(OrgRole).map((role) => (
                  <SelectItem key={role} value={role}>
                    {ORG_ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PermissionGateView>
        ) : (
          <Select
            value={orgRole}
            onValueChange={(next) => setOrgRole(next as OrgRole)}
            disabled={!canManage}
          >
            <SelectTrigger
              id="edit-org-member-role"
              className="w-full"
              aria-label="Organisation role"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(OrgRole).map((role) => (
                <SelectItem key={role} value={role}>
                  {ORG_ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PermissionGateView allowed={canManage} denialMessage={manageOrgMemberDenialMessage()}>
          <Button
            type="button"
            disabled={!canManage || !roleChanged || lastOwner}
            loading={updateMember.isPending && roleChanged}
            onClick={() => void onSave()}
          >
            Save
          </Button>
        </PermissionGateView>
        {lastOwner && !suspended ? (
          <PermissionGateView allowed={false} denialMessage={lastOrgOwnerDenialMessage()}>
            <Button type="button" variant="outline" disabled>
              Suspend
            </Button>
          </PermissionGateView>
        ) : (
          <PermissionGateView allowed={canManage} denialMessage={manageOrgMemberDenialMessage()}>
            <Button
              type="button"
              variant="outline"
              disabled={!canManage}
              loading={updateMember.isPending && !roleChanged}
              onClick={() => void onToggleStatus()}
            >
              {suspended ? 'Activate' : 'Suspend'}
            </Button>
          </PermissionGateView>
        )}
      </div>
    </div>
  )
}

export function EditOrgMemberSheet({
  orgId,
  member,
  members,
  canManage,
  open,
  onOpenChange,
  onError,
}: {
  orgId: string
  member: MembershipWithUser | null
  members: MembershipWithUser[]
  canManage: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onError: (message: string) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="min-w-0 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{member ? `Edit ${member.user.name}` : 'Edit member'}</SheetTitle>
        </SheetHeader>
        {member ? (
          <EditOrgMemberSheetBody
            key={member.id}
            orgId={orgId}
            member={member}
            members={members}
            canManage={canManage}
            onClose={() => onOpenChange(false)}
            onError={onError}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
