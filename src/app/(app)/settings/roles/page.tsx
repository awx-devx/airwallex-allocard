'use client'

import { useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { useCreateRole, useRoles } from '@/client/hooks/useMembers'
import { useMe, usePermissions } from '@/client/hooks/useSession'
import { assignRoleDenialMessage } from '@/client/lib/access'
import { activeOrgRole } from '@/client/lib/projects'
import { useCan } from '@/client/lib/permissions/useCan'
import { useActiveOrg } from '@/client/providers/ActiveOrgProvider'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'

export default function RolesSettingsPage() {
  const roles = useRoles()
  const createRole = useCreateRole()
  const me = useMe()
  const permissions = usePermissions()
  const { orgId } = useActiveOrg()
  const projectId = permissions.data?.projects[0]?.projectId
  const { can } = useCan(projectId ?? '')
  const orgRole = activeOrgRole(me.data?.memberships ?? [], orgId ?? me.data?.activeOrg?.id ?? null)
  const allowed = projectId
    ? can(Permission.ROLE_ASSIGN)
    : orgRole === OrgRole.OWNER || orgRole === OrgRole.ADMIN

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  async function onCreate() {
    const trimmed = name.trim()
    if (trimmed.length < 1 || trimmed.length > 120) {
      return
    }
    setAlertMessage(null)
    try {
      await createRole.mutateAsync({
        name: trimmed,
        permissions: [Permission.PROJECT_VIEW],
      })
      setCreateOpen(false)
      setName('')
    } catch (error) {
      setAlertMessage(isApiError(error) ? error.message : 'Unable to create role')
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {alertMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{alertMessage}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-sm font-medium">Roles</h1>
        <PermissionGateView allowed={allowed} denialMessage={assignRoleDenialMessage()}>
          <Button type="button" disabled={!allowed} onClick={() => setCreateOpen(true)}>
            Create role
          </Button>
        </PermissionGateView>
      </div>
      <ul className="flex min-w-0 flex-col gap-2">
        {(roles.data ?? []).map((role) => (
          <li key={role.id} className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="min-w-0 break-all">{role.name}</span>
            <Badge>{role.isTemplate ? 'Template' : 'Custom'}</Badge>
          </li>
        ))}
      </ul>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create role</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-role-name">Name</Label>
            <Input
              id="create-role-name"
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={name.trim().length < 1 || name.trim().length > 120}
              loading={createRole.isPending}
              onClick={() => void onCreate()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
