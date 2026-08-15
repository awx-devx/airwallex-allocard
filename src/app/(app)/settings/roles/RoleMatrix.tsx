'use client'

import { useQueries } from '@tanstack/react-query'
import { Fragment, useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { useCall } from '@/client/hooks/useCall'
import {
  projectMembersQueryOptions,
  useDeleteRole,
  useRoles,
  useUpdateRole,
} from '@/client/hooks/useMembers'
import { useProjects } from '@/client/hooks/useProjects'
import { useMe, usePermissions } from '@/client/hooks/useSession'
import {
  assignRoleDenialMessage,
  countMembersHoldingRole,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  permissionGateAllowed,
  sortRolesForMatrix,
} from '@/client/lib/access'
import { activeOrgRole } from '@/client/lib/projects'
import { useCan } from '@/client/lib/permissions/useCan'
import { useActiveOrg } from '@/client/providers/ActiveOrgProvider'
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import type { Role } from '@/shared/types/role'

function samePermissions(a: Permission[], b: Permission[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  const set = new Set(a)
  return b.every((permission) => set.has(permission))
}

function assignedWarning(count: number, projectsCounted: number, projectsTotal: number): string {
  const base = `This role is assigned to ${count} member(s). Their effective permissions will be recomputed.`
  if (projectsTotal > projectsCounted) {
    return `${base} Counted on the first ${projectsCounted} of ${projectsTotal} projects.`
  }
  return base
}

type PendingSave = {
  role: Role
  permissions: Permission[]
  force?: true
  title: string
  confirmLabel: string
  description: string
}

export function RoleMatrix() {
  const rolesQuery = useRoles()
  const projects = useProjects({ page: 1, pageSize: 100, sort: 'name' })
  const callWithOrg = useCall()
  const updateRole = useUpdateRole()
  const deleteRole = useDeleteRole()
  const me = useMe()
  const permissionsQuery = usePermissions()
  const { orgId } = useActiveOrg()
  const projectId = permissionsQuery.data?.projects[0]?.projectId
  const { can, isLoading } = useCan(projectId ?? '')
  const orgRole = activeOrgRole(me.data?.memberships ?? [], orgId ?? me.data?.activeOrg?.id ?? null)
  const allowed = permissionGateAllowed(
    projectId
      ? can(Permission.ROLE_ASSIGN)
      : orgRole === OrgRole.OWNER || orgRole === OrgRole.ADMIN,
    isLoading || me.isPending,
  )

  const memberQueries = useQueries({
    queries: (projects.data?.items ?? []).map((project) =>
      projectMembersQueryOptions(project.id, callWithOrg),
    ),
  })
  const lists = memberQueries.map((query) => query.data ?? [])
  const holdersLoading = projects.isPending || memberQueries.some((query) => query.isPending)

  const [overrides, setOverrides] = useState<Record<string, Permission[]>>({})
  const [confirm, setConfirm] = useState<{ open: boolean; payload: PendingSave | null }>({
    open: false,
    payload: null,
  })
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  const roles = sortRolesForMatrix(rolesQuery.data ?? [])

  function permissionsFor(role: Role): Permission[] {
    return overrides[role.id] ?? role.permissions
  }

  function toggle(role: Role, permission: Permission, checked: boolean) {
    const current = permissionsFor(role)
    const next = checked
      ? current.includes(permission)
        ? current
        : [...current, permission]
      : current.filter((item) => item !== permission)
    setOverrides((prev) => ({ ...prev, [role.id]: next }))
  }

  async function persist(role: Role, permissions: Permission[], force?: true) {
    setAlertMessage(null)
    try {
      await updateRole.mutateAsync({
        id: role.id,
        input: force ? { permissions, force: true } : { permissions },
      })
      setOverrides((prev) => {
        const next = { ...prev }
        delete next[role.id]
        return next
      })
    } catch (error) {
      setAlertMessage(isApiError(error) ? error.message : 'Unable to update role')
    }
  }

  function requestSave(role: Role) {
    const nextPermissions = permissionsFor(role)
    if (nextPermissions.length < 1) {
      setAlertMessage('A role needs at least one permission.')
      return
    }
    const count = countMembersHoldingRole(role.id, lists)
    if (count === 0) {
      void persist(role, nextPermissions)
      return
    }
    const description = assignedWarning(
      count,
      projects.data?.items.length ?? 0,
      projects.data?.total ?? 0,
    )
    if (role.isTemplate) {
      setConfirm({
        open: true,
        payload: {
          role,
          permissions: nextPermissions,
          force: true,
          title: 'Update this template?',
          confirmLabel: 'Save anyway',
          description,
        },
      })
      return
    }
    setConfirm({
      open: true,
      payload: {
        role,
        permissions: nextPermissions,
        title: 'Update this role?',
        confirmLabel: 'Save',
        description,
      },
    })
  }

  async function onDelete(role: Role) {
    setAlertMessage(null)
    try {
      await deleteRole.mutateAsync({ id: role.id })
    } catch (error) {
      setAlertMessage(isApiError(error) ? error.message : 'Unable to delete role')
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {alertMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{alertMessage}</AlertDescription>
        </Alert>
      ) : null}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Permission</TableHead>
              {roles.map((role) => (
                <TableHead key={role.id}>
                  <div className="flex flex-col gap-1">
                    <span>{role.name}</span>
                    <Badge>{role.isTemplate ? 'Template' : 'Custom'}</Badge>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {PERMISSION_GROUPS.map((group) => (
              <Fragment key={group.id}>
                <TableRow>
                  <TableCell colSpan={1 + roles.length} className="font-medium">
                    {group.label}
                  </TableCell>
                </TableRow>
                {group.permissions.map((permission) => (
                  <TableRow key={permission}>
                    <TableCell>{PERMISSION_LABELS[permission]}</TableCell>
                    {roles.map((role) => {
                      const checked = permissionsFor(role).includes(permission)
                      return (
                        <TableCell key={role.id}>
                          <Checkbox
                            checked={checked}
                            aria-label={`${role.name} ${PERMISSION_LABELS[permission]}`}
                            onCheckedChange={(state) => toggle(role, permission, state === true)}
                          />
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-3">
        {roles.map((role) => {
          const dirty = !samePermissions(permissionsFor(role), role.permissions)
          const count = countMembersHoldingRole(role.id, lists)
          const deleteDenied = role.isTemplate
            ? 'Cannot delete a template.'
            : count > 0
              ? `This role is assigned to ${count} member(s).`
              : null
          return (
            <div key={role.id} className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 break-all text-sm">{role.name}</span>
              <PermissionGateView allowed={allowed} denialMessage={assignRoleDenialMessage()}>
                <Button
                  type="button"
                  size="sm"
                  disabled={!allowed || !dirty || holdersLoading}
                  loading={updateRole.isPending && confirm.payload?.role.id === role.id}
                  onClick={() => requestSave(role)}
                >
                  Save
                </Button>
              </PermissionGateView>
              <PermissionGateView
                allowed={allowed && deleteDenied === null}
                denialMessage={!allowed ? assignRoleDenialMessage() : (deleteDenied ?? '')}
              >
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!allowed || deleteDenied !== null || holdersLoading}
                  loading={deleteRole.isPending}
                  onClick={() => void onDelete(role)}
                >
                  Delete
                </Button>
              </PermissionGateView>
            </div>
          )
        })}
      </div>
      <ConfirmDialog
        open={confirm.open}
        onOpenChange={(open) => setConfirm((prev) => ({ ...prev, open }))}
        title={confirm.payload?.title ?? 'Update this role?'}
        description={confirm.payload?.description ?? ''}
        confirmLabel={confirm.payload?.confirmLabel ?? 'Save'}
        variant="default"
        loading={updateRole.isPending}
        onConfirm={() => {
          const next = confirm.payload
          if (next === null) return
          setConfirm((prev) => ({ ...prev, open: false }))
          void persist(next.role, next.permissions, next.force)
        }}
      />
    </div>
  )
}
