'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { FieldValues, UseFormReturn } from 'react-hook-form'
import { isApiError } from '@/client/api/errors'
import {
  useAddMember,
  usePreviewMember,
  useProjectMembers,
  useRoles,
} from '@/client/hooks/useMembers'
import { useOrgMembers } from '@/client/hooks/useOrganizations'
import {
  addMemberDenialMessage,
  buildAccessScope,
  eligibleOrgMembersToAdd,
  isScopeSelectionComplete,
  peopleHref,
} from '@/client/lib/access'
import { applyServerErrorsFromApiError, useZodForm } from '@/client/lib/forms'
import { useCan } from '@/client/lib/permissions/useCan'
import { useActiveOrg } from '@/client/providers/ActiveOrgProvider'
import { PermissionPreview } from '@/app/(app)/projects/[id]/people/PermissionPreview'
import { ScopePicker } from '@/app/(app)/projects/[id]/people/ScopePicker'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { ErrorCode } from '@/shared/enums/errors'
import { Permission } from '@/shared/enums/permissions'
import { addProjectMemberInput } from '@/shared/schemas/projectMember'
import type { PreviewProjectMemberOutput } from '@/shared/types/projectMember'

const DEFAULT_SCOPE = { level: AccessScopeLevel.PROJECT }

export function AddMemberForm() {
  const raw = useParams().id
  const id = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : ''
  const router = useRouter()
  const { orgId } = useActiveOrg()
  const { can } = useCan(id)
  const orgMembers = useOrgMembers(orgId ?? '')
  const projectMembers = useProjectMembers(id)
  const roles = useRoles()
  const addMember = useAddMember()
  const { mutate: previewMutate } = usePreviewMember()
  const generation = useRef(0)
  const [previewResult, setPreviewResult] = useState<PreviewProjectMemberOutput | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  const form = useZodForm(addProjectMemberInput, {
    defaultValues: {
      userId: '',
      roleId: '',
      scope: DEFAULT_SCOPE,
    },
  })

  const userId = form.watch('userId')
  const roleId = form.watch('roleId')
  const scope = form.watch('scope')
  const eligible = eligibleOrgMembersToAdd(orgMembers.data ?? [], projectMembers.data ?? [])
  const scopeComplete = isScopeSelectionComplete(scope)
  const previewReady = Boolean(roleId) && scopeComplete
  const canSubmit = Boolean(userId) && previewReady
  const allowed = can(Permission.MEMBER_MANAGE)

  useEffect(() => {
    if (!id || !previewReady) {
      return
    }
    const gen = ++generation.current
    previewMutate(
      { id, input: { roleId, scope } },
      {
        onSuccess: (data) => {
          if (gen === generation.current) {
            setPreviewResult(data)
          }
        },
      },
    )
  }, [id, previewMutate, previewReady, roleId, scope])

  async function onSubmit(values: { userId: string; roleId: string; scope: typeof scope }) {
    setAlertMessage(null)
    try {
      await addMember.mutateAsync({
        id,
        input: {
          userId: values.userId,
          roleId: values.roleId,
          scope: buildAccessScope(values.scope),
        },
      })
      router.push(peopleHref(id))
    } catch (error) {
      if (isApiError(error) && error.code === ErrorCode.VALIDATION_FAILED) {
        applyServerErrorsFromApiError(form as unknown as UseFormReturn<FieldValues>, error)
        return
      }
      setAlertMessage(isApiError(error) ? error.message : 'Unable to add member')
    }
  }

  const memberNames = Object.fromEntries(
    (projectMembers.data ?? []).map((member) => [member.userId, member.user.name]),
  )

  return (
    <Form {...form}>
      <form
        onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
        className="flex min-w-0 flex-col gap-6 md:flex-row"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {alertMessage ? (
            <Alert variant="destructive">
              <AlertDescription>{alertMessage}</AlertDescription>
            </Alert>
          ) : null}
          <FormField
            control={form.control}
            name="userId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Person</FormLabel>
                <FormControl>
                  <Combobox
                    options={eligible.map((user) => ({
                      value: user.id,
                      label: `${user.name} (${user.email})`,
                    }))}
                    value={field.value || null}
                    onChange={(value) => field.onChange(value ?? '')}
                    placeholder="Select a person"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="roleId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select
                  value={field.value || undefined}
                  onValueChange={(nextRoleId) => {
                    const role = (roles.data ?? []).find((row) => row.id === nextRoleId)
                    field.onChange(nextRoleId)
                    form.setValue('scope', role?.defaultScope ?? DEFAULT_SCOPE, {
                      shouldDirty: true,
                    })
                  }}
                >
                  <FormControl>
                    <SelectTrigger className="w-full" aria-label="Role">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(roles.data ?? []).map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="scope"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Scope</FormLabel>
                <FormControl>
                  <ScopePicker
                    projectId={id}
                    value={field.value}
                    onChange={field.onChange}
                    members={projectMembers.data}
                    excludeUserId={userId || undefined}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex flex-wrap gap-2">
            <PermissionGateView allowed={allowed} denialMessage={addMemberDenialMessage()}>
              <Button type="submit" disabled={!canSubmit || !allowed} loading={addMember.isPending}>
                Add member
              </Button>
            </PermissionGateView>
            <Button asChild variant="outline">
              <Link href={peopleHref(id)}>Cancel</Link>
            </Button>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <PermissionPreview
            complete={previewReady}
            scope={scope}
            reasons={previewResult?.reasons}
            names={{ members: memberNames }}
          />
        </div>
      </form>
    </Form>
  )
}
