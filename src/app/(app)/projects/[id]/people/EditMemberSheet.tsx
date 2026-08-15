'use client'

import { useEffect, useRef, useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { usePreviewMember, useRoles, useUpdateMember } from '@/client/hooks/useMembers'
import {
  addMemberDenialMessage,
  buildAccessScope,
  isScopeSelectionComplete,
} from '@/client/lib/access'
import { useCan } from '@/client/lib/permissions/useCan'
import { PermissionPreview } from '@/app/(app)/projects/[id]/people/PermissionPreview'
import { ScopePicker } from '@/app/(app)/projects/[id]/people/ScopePicker'
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
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { Permission } from '@/shared/enums/permissions'
import type { AccessScope } from '@/shared/types/accessScope'
import type { PreviewProjectMemberOutput, ProjectMemberDetail } from '@/shared/types/projectMember'

function EditMemberSheetBody({
  projectId,
  member,
  members,
  onClose,
}: {
  projectId: string
  member: ProjectMemberDetail
  members: ProjectMemberDetail[]
  onClose: () => void
}) {
  const { can } = useCan(projectId)
  const roles = useRoles()
  const updateMember = useUpdateMember()
  const { mutate: previewMutate } = usePreviewMember()
  const generation = useRef(0)
  const [roleId, setRoleId] = useState(member.roleId)
  const [scope, setScope] = useState<AccessScope>(member.scope)
  const [previewResult, setPreviewResult] = useState<PreviewProjectMemberOutput | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  const previewReady = Boolean(roleId) && isScopeSelectionComplete(scope)
  const allowed = can(Permission.MEMBER_MANAGE)

  useEffect(() => {
    if (!projectId || !previewReady) {
      return
    }
    const gen = ++generation.current
    previewMutate(
      { id: projectId, input: { roleId, scope } },
      {
        onSuccess: (data) => {
          if (gen === generation.current) {
            setPreviewResult(data)
          }
        },
      },
    )
  }, [projectId, previewMutate, previewReady, roleId, scope])

  async function onSave() {
    setAlertMessage(null)
    try {
      await updateMember.mutateAsync({
        id: projectId,
        userId: member.userId,
        input: { roleId, scope: buildAccessScope(scope) },
      })
      onClose()
    } catch (error) {
      setAlertMessage(isApiError(error) ? error.message : 'Unable to update member')
    }
  }

  const memberNames = Object.fromEntries(members.map((row) => [row.userId, row.user.name]))

  return (
    <div className="flex min-w-0 flex-col gap-4 px-4 pb-4">
      {alertMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{alertMessage}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="edit-member-role">Role</Label>
        <Select
          value={roleId || undefined}
          onValueChange={(nextRoleId) => {
            const role = (roles.data ?? []).find((row) => row.id === nextRoleId)
            setRoleId(nextRoleId)
            setScope(role?.defaultScope ?? { level: AccessScopeLevel.PROJECT })
          }}
        >
          <SelectTrigger id="edit-member-role" className="w-full" aria-label="Role">
            <SelectValue placeholder="Select a role" />
          </SelectTrigger>
          <SelectContent>
            {(roles.data ?? []).map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ScopePicker
        projectId={projectId}
        value={scope}
        onChange={setScope}
        members={members}
        excludeUserId={member.userId}
      />
      <PermissionPreview
        complete={previewReady}
        scope={scope}
        reasons={previewResult?.reasons}
        names={{ members: memberNames }}
      />
      <PermissionGateView allowed={allowed} denialMessage={addMemberDenialMessage()}>
        <Button
          type="button"
          disabled={!previewReady || !allowed}
          loading={updateMember.isPending}
          onClick={() => void onSave()}
        >
          Save
        </Button>
      </PermissionGateView>
    </div>
  )
}

export function EditMemberSheet({
  projectId,
  member,
  members,
  open,
  onOpenChange,
}: {
  projectId: string
  member: ProjectMemberDetail | null
  members: ProjectMemberDetail[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="min-w-0 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{member ? `Edit ${member.user.name}` : 'Edit member'}</SheetTitle>
        </SheetHeader>
        {member ? (
          <EditMemberSheetBody
            key={member.id}
            projectId={projectId}
            member={member}
            members={members}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
