'use client'

import { useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { isApiError } from '@/client/api/errors'
import {
  useCreateInvite,
  useInvites,
  useOrgMembers,
  useRemoveOrgMember,
  useRevokeInvite,
} from '@/client/hooks/useOrganizations'
import { useMe } from '@/client/hooks/useSession'
import {
  holdsOrgManage,
  inviteOrgDenialMessage,
  inviteShareUrl,
  isLastOrgOwner,
  lastOrgOwnerDenialMessage,
  manageOrgMemberDenialMessage,
  ORG_ROLE_LABELS,
  permissionGateAllowed,
} from '@/client/lib/access'
import { copyToClipboard } from '@/client/lib/clipboard'
import { activeOrgRole } from '@/client/lib/projects'
import { useActiveOrg } from '@/client/providers/ActiveOrgProvider'
import { EditOrgMemberSheet } from '@/app/(app)/settings/members/EditOrgMemberSheet'
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog'
import { DataTable } from '@/components/patterns/DataTable'
import { PageHeader } from '@/components/patterns/PageHeader'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import type { DataTableColumn } from '@/components/patterns/types'
import { PageFill } from '@/components/patterns/PageBody'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate } from '@/lib/dates'
import { MembershipStatus } from '@/shared/enums/membershipStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import type { Invite } from '@/shared/types/invite'
import type { MembershipWithUser } from '@/shared/types/membership'

function InviteControl({ allowed, onInvite }: { allowed: boolean; onInvite: () => void }) {
  return (
    <PermissionGateView allowed={allowed} denialMessage={inviteOrgDenialMessage()}>
      <Button type="button" disabled={!allowed} onClick={onInvite}>
        <PlusIcon className="size-4 shrink-0" aria-hidden />
        Invite
      </Button>
    </PermissionGateView>
  )
}

function PendingInvitesTable({
  canManage,
  onRevoke,
}: {
  canManage: boolean
  onRevoke: (invite: Invite) => void
}) {
  const invites = useInvites(canManage)
  const columns: DataTableColumn<Invite>[] = [
    {
      id: 'email',
      header: 'Email',
      cell: (row) => <span className="min-w-0 break-all">{row.email}</span>,
    },
    {
      id: 'orgRole',
      header: 'Role',
      cell: (row) => ORG_ROLE_LABELS[row.orgRole],
    },
    {
      id: 'expiresAt',
      header: 'Expires',
      cell: (row) => formatDate(row.expiresAt),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (row) => (
        <PermissionGateView allowed={canManage} denialMessage={inviteOrgDenialMessage()}>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canManage}
            onClick={() => onRevoke(row)}
          >
            Revoke
          </Button>
        </PermissionGateView>
      ),
    },
  ]

  return (
    <div className="flex min-h-64 min-w-0 flex-1 flex-col gap-2">
      <h2 className="text-lg font-semibold tracking-tight">Pending invites</h2>
      <DataTable
        columns={columns}
        rows={invites.data ?? []}
        getRowId={(row) => row.id}
        pagination={{
          mode: 'page',
          page: 1,
          pageSize: Math.max(invites.data?.length ?? 0, 1),
          total: invites.data?.length ?? 0,
          onPageChange: () => undefined,
        }}
        loading={invites.isPending}
        error={
          invites.error
            ? {
                message: isApiError(invites.error)
                  ? invites.error.message
                  : 'Unable to load invites',
                onRetry: () => void invites.refetch(),
              }
            : undefined
        }
        empty={{
          title: 'No pending invites',
          description: 'Invite someone with their email. Share the link you get back.',
        }}
      />
    </div>
  )
}

export function OrgMembers() {
  const me = useMe()
  const { orgId } = useActiveOrg()
  const resolvedOrgId = orgId ?? me.data?.activeOrg?.id ?? ''
  const members = useOrgMembers(resolvedOrgId)
  const createInvite = useCreateInvite()
  const revokeInvite = useRevokeInvite()
  const removeMember = useRemoveOrgMember()
  const orgRole = activeOrgRole(me.data?.memberships ?? [], resolvedOrgId || null)
  const canManage = permissionGateAllowed(holdsOrgManage(orgRole), me.isPending)
  const invitesEnabled = holdsOrgManage(orgRole)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<OrgRole>(OrgRole.MEMBER)
  const [createdLink, setCreatedLink] = useState<string | null>(null)
  const [editing, setEditing] = useState<MembershipWithUser | null>(null)
  const [removeDialog, setRemoveDialog] = useState<{
    open: boolean
    member: MembershipWithUser | null
  }>({ open: false, member: null })
  const [revokeDialog, setRevokeDialog] = useState<{ open: boolean; invite: Invite | null }>({
    open: false,
    invite: null,
  })
  const [actionError, setActionError] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)

  const columns: DataTableColumn<MembershipWithUser>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <span className="min-w-0 break-all">{row.user.name}</span>
          <span className="text-sm text-muted-foreground">{row.user.email}</span>
        </div>
      ),
    },
    {
      id: 'orgRole',
      header: 'Role',
      cell: (row) => ORG_ROLE_LABELS[row.orgRole],
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) =>
        row.status === MembershipStatus.ACTIVE ? (
          'Active'
        ) : (
          <span className="text-muted-foreground">Suspended</span>
        ),
    },
    {
      id: 'joinedAt',
      header: 'Joined',
      cell: (row) => formatDate(row.joinedAt),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (row) => {
        const lastOwner = isLastOrgOwner(members.data ?? [], row.userId)
        return (
          <div className="flex flex-wrap items-center gap-2">
            <PermissionGateView allowed={canManage} denialMessage={manageOrgMemberDenialMessage()}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!canManage}
                onClick={() => setEditing(row)}
              >
                Edit
              </Button>
            </PermissionGateView>
            {lastOwner ? (
              <PermissionGateView allowed={false} denialMessage={lastOrgOwnerDenialMessage()}>
                <Button type="button" size="sm" variant="outline" disabled>
                  Remove
                </Button>
              </PermissionGateView>
            ) : (
              <PermissionGateView
                allowed={canManage}
                denialMessage={manageOrgMemberDenialMessage()}
              >
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!canManage}
                  onClick={() => setRemoveDialog({ open: true, member: row })}
                >
                  Remove
                </Button>
              </PermissionGateView>
            )}
          </div>
        )
      },
    },
  ]

  async function onCreateInvite() {
    const email = inviteEmail.trim().toLowerCase()
    if (email.length < 1) {
      return
    }
    setInviteError(null)
    setActionError(null)
    try {
      const created = await createInvite.mutateAsync({ email, orgRole: inviteRole })
      const url = inviteShareUrl(window.location.origin, created.token)
      createInvite.reset()
      setInviteOpen(false)
      setInviteEmail('')
      setInviteRole(OrgRole.MEMBER)
      setCreatedLink(url)
    } catch (error) {
      setInviteError(isApiError(error) ? error.message : 'Unable to create invite')
    }
  }

  return (
    <PageFill>
      {actionError ? (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}
      <PageHeader
        title="Members"
        actions={<InviteControl allowed={canManage} onInvite={() => setInviteOpen(true)} />}
      />
      <DataTable
        columns={columns}
        rows={members.data ?? []}
        getRowId={(row) => row.id}
        pagination={{
          mode: 'page',
          page: 1,
          pageSize: Math.max(members.data?.length ?? 0, 1),
          total: members.data?.length ?? 0,
          onPageChange: () => undefined,
        }}
        loading={members.isPending}
        error={
          members.error
            ? {
                message: isApiError(members.error)
                  ? members.error.message
                  : 'Unable to load members',
                onRetry: () => void members.refetch(),
              }
            : undefined
        }
        empty={{
          title: 'No members yet',
          description: 'Invite someone with their email.',
          action: canManage ? { label: 'Invite', onClick: () => setInviteOpen(true) } : undefined,
        }}
      />
      {invitesEnabled ? (
        <PendingInvitesTable
          canManage={canManage}
          onRevoke={(invite) => setRevokeDialog({ open: true, invite })}
        />
      ) : null}
      <EditOrgMemberSheet
        orgId={resolvedOrgId}
        member={editing}
        members={members.data ?? []}
        canManage={canManage}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onError={setActionError}
      />
      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open)
          if (!open) {
            setInviteError(null)
            setInviteEmail('')
            setInviteRole(OrgRole.MEMBER)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite to organisation</DialogTitle>
            <DialogDescription>
              Share the one-time link you get next. It expires in 7 days. The recipient must sign in
              as this email.
            </DialogDescription>
          </DialogHeader>
          {inviteError ? (
            <Alert variant="destructive">
              <AlertDescription>{inviteError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="invite-org-role">Organisation role</Label>
              <Select value={inviteRole} onValueChange={(next) => setInviteRole(next as OrgRole)}>
                <SelectTrigger
                  id="invite-org-role"
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
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={inviteEmail.trim().length < 1}
              loading={createInvite.isPending}
              onClick={() => void onCreateInvite()}
            >
              Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={createdLink !== null}
        onOpenChange={(open) => {
          if (!open) setCreatedLink(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite link</DialogTitle>
            <DialogDescription>
              Share this link. It is shown once and expires in 7 days. The recipient must sign in as
              the invited email. If you lose it, revoke the invite and send a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="invite-link">Link</Label>
            <Input id="invite-link" readOnly value={createdLink ?? ''} />
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                if (createdLink) void copyToClipboard(createdLink)
              }}
            >
              Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={removeDialog.open}
        onOpenChange={(open) => setRemoveDialog((prev) => ({ ...prev, open }))}
        title={
          removeDialog.member
            ? `Remove ${removeDialog.member.user.name} from this organisation?`
            : 'Remove member?'
        }
        description="They will lose organisation access immediately."
        confirmLabel="Remove"
        variant="destructive"
        loading={removeMember.isPending}
        onConfirm={() => {
          const row = removeDialog.member
          if (row === null || !resolvedOrgId) return
          setRemoveDialog((prev) => ({ ...prev, open: false }))
          setActionError(null)
          void removeMember
            .mutateAsync({ id: resolvedOrgId, userId: row.userId })
            .catch((error: unknown) => {
              setActionError(isApiError(error) ? error.message : 'Unable to remove member')
            })
        }}
      />
      <ConfirmDialog
        open={revokeDialog.open}
        onOpenChange={(open) => setRevokeDialog((prev) => ({ ...prev, open }))}
        title={
          revokeDialog.invite ? `Revoke invite for ${revokeDialog.invite.email}?` : 'Revoke invite?'
        }
        description="The invite link will stop working."
        confirmLabel="Revoke"
        variant="destructive"
        loading={revokeInvite.isPending}
        onConfirm={() => {
          const row = revokeDialog.invite
          if (row === null) return
          setRevokeDialog((prev) => ({ ...prev, open: false }))
          setActionError(null)
          void revokeInvite.mutateAsync({ id: row.id }).catch((error: unknown) => {
            setActionError(isApiError(error) ? error.message : 'Unable to revoke invite')
          })
        }}
      />
    </PageFill>
  )
}
