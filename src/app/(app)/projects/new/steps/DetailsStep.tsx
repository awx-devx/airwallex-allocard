'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { FieldValues, UseFormReturn } from 'react-hook-form'
import { isApiError } from '@/client/api/errors'
import {
  useCreateProject,
  useCreateWorkstream,
  useDeleteWorkstream,
  useUpdateProject,
  useWorkstreams,
} from '@/client/hooks/useProjects'
import { useMe } from '@/client/hooks/useSession'
import { applyServerErrorsFromApiError, useZodForm } from '@/client/lib/forms'
import {
  draftWizardHref,
  normalisedWorkstreamName,
  queueWorkstreamNames,
  withoutPendingWorkstream,
} from '@/client/lib/projects'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ErrorCode } from '@/shared/enums/errors'
import { createProjectInput } from '@/shared/schemas/project'
import type { Project, ProjectDetail } from '@/shared/types/project'

export type DetailsStepHandle = {
  submit: () => Promise<string | null>
}

export type DetailsStepProps = {
  draftId: string | null
  project: Project | ProjectDetail | undefined
  user: { id: string; name: string }
  launched: boolean
  onValidChange: (valid: boolean) => void
  onDirtyChange: (dirty: boolean) => void
}

export const DetailsStep = forwardRef<DetailsStepHandle, DetailsStepProps>(function DetailsStep(
  { draftId, project, user, launched, onValidChange, onDirtyChange },
  ref,
) {
  const router = useRouter()
  const me = useMe()
  const create = useCreateProject()
  const update = useUpdateProject()
  const createWorkstream = useCreateWorkstream()
  const deleteWorkstream = useDeleteWorkstream()
  const workstreams = useWorkstreams(draftId ?? '')
  const form = useZodForm(createProjectInput, {
    mode: 'onChange',
    defaultValues: {
      name: '',
      code: '',
      description: '',
      ownerId: user.id,
      costCentre: undefined,
      startDate: undefined,
      endDate: undefined,
    },
  })
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [workstreamName, setWorkstreamName] = useState('')
  const [pendingWorkstreams, setPendingWorkstreams] = useState<string[]>([])
  const hydratedId = useRef<string | null>(null)
  const activeOrg = me.data?.activeOrg
  const costCentreOptions = (activeOrg?.costCentres ?? []).map((centre) => ({
    value: centre,
    label: centre,
  }))

  useEffect(() => {
    onValidChange(form.formState.isValid)
  }, [form.formState.isValid, onValidChange])

  useEffect(() => {
    onDirtyChange(
      form.formState.isDirty || pendingWorkstreams.length > 0 || workstreamName.trim().length > 0,
    )
  }, [form.formState.isDirty, onDirtyChange, pendingWorkstreams.length, workstreamName])

  useEffect(() => {
    if (!project || hydratedId.current === project.id) return
    hydratedId.current = project.id
    form.reset({
      name: project.name,
      code: project.code,
      description: project.description,
      ownerId: project.ownerId ?? user.id,
      costCentre: project.costCentre ?? undefined,
      startDate: project.startDate ?? undefined,
      endDate: project.endDate ?? undefined,
    })
  }, [form, project, user.id])

  async function persistQueuedWorkstreams(projectId: string, names: string[]): Promise<void> {
    setWorkstreamName('')
    setPendingWorkstreams(names)
    for (let i = 0; i < names.length; i++) {
      await createWorkstream.mutateAsync({ id: projectId, input: { name: names[i]! } })
      setPendingWorkstreams(names.slice(i + 1))
    }
  }

  async function submit(): Promise<string | null> {
    if (launched) return null
    setErrorMessage(null)
    const values = form.getValues()
    const queued = queueWorkstreamNames(pendingWorkstreams, workstreamName)
    let projectId: string
    try {
      if (!draftId) {
        const created = await create.mutateAsync({
          name: values.name,
          code: values.code,
          ...(values.description !== undefined && values.description.length > 0
            ? { description: values.description }
            : {}),
          ownerId: user.id,
          ...(values.costCentre ? { costCentre: values.costCentre } : {}),
          ...(values.startDate ? { startDate: values.startDate } : {}),
          ...(values.endDate ? { endDate: values.endDate } : {}),
        })
        projectId = created.id
        router.replace(draftWizardHref(created.id))
      } else {
        await update.mutateAsync({
          id: draftId,
          input: {
            name: values.name,
            code: values.code,
            description: values.description ?? '',
            costCentre: values.costCentre ?? null,
            startDate: values.startDate ?? null,
            endDate: values.endDate ?? null,
          },
        })
        projectId = draftId
      }
    } catch (error) {
      if (isApiError(error) && error.code === ErrorCode.VALIDATION_FAILED) {
        applyServerErrorsFromApiError(form as unknown as UseFormReturn<FieldValues>, error)
        return null
      }
      setErrorMessage(isApiError(error) ? error.message : 'Unable to save project')
      return null
    }

    try {
      await persistQueuedWorkstreams(projectId, queued)
    } catch (error) {
      setErrorMessage(isApiError(error) ? error.message : 'Unable to add workstream')
    }
    return projectId
  }

  useImperativeHandle(ref, () => ({ submit }))

  async function addWorkstream() {
    if (launched) return
    const name = normalisedWorkstreamName(workstreamName)
    if (!name) return
    if (!draftId) {
      setPendingWorkstreams((current) => [...current, name])
      setWorkstreamName('')
      return
    }
    try {
      await createWorkstream.mutateAsync({ id: draftId, input: { name } })
      setWorkstreamName('')
    } catch (error) {
      setErrorMessage(isApiError(error) ? error.message : 'Unable to add workstream')
    }
  }

  function removePending(index: number) {
    if (launched) return
    setPendingWorkstreams((current) => withoutPendingWorkstream(current, index))
  }

  async function removeSaved(wsId: string) {
    if (!draftId || launched) return
    try {
      await deleteWorkstream.mutateAsync({ id: draftId, wsId })
    } catch (error) {
      setErrorMessage(isApiError(error) ? error.message : 'Unable to remove workstream')
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {errorMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
      <Form {...form}>
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={120} disabled={launched} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={64} disabled={launched} />
                </FormControl>
                <FormDescription>Letters, numbers, hyphens.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea {...field} maxLength={2000} disabled={launched} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="startDate"
            render={() => (
              <FormItem>
                <FormLabel>Dates</FormLabel>
                <FormControl>
                  <DateRangePicker
                    from={form.watch('startDate') ?? null}
                    to={form.watch('endDate') ?? null}
                    disabled={launched}
                    onChange={({ from, to }) => {
                      form.setValue('startDate', from ?? undefined, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                      form.setValue('endDate', to ?? undefined, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="costCentre"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cost centre</FormLabel>
                <FormControl>
                  <Combobox
                    options={costCentreOptions}
                    value={field.value ?? null}
                    onChange={(value) => field.onChange(value ?? undefined)}
                    placeholder="Select cost centre"
                    disabled={launched}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <p className="text-sm text-muted-foreground md:col-span-2">Owner: {user.name}</p>
        </div>
      </Form>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Workstreams</p>
        <p className="text-sm text-muted-foreground">
          Optional. Named slices for budget and access.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <Input
            value={workstreamName}
            onChange={(event) => setWorkstreamName(event.target.value)}
            maxLength={120}
            disabled={launched}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void addWorkstream()
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => void addWorkstream()}
            disabled={launched || createWorkstream.isPending}
          >
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(workstreams.data ?? project?.workstreams ?? []).map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant="outline"
              aria-label={`Remove ${item.name}`}
              disabled={launched || deleteWorkstream.isPending}
              onClick={() => void removeSaved(item.id)}
            >
              {item.name}
            </Button>
          ))}
          {pendingWorkstreams.map((name, index) => (
            <Button
              key={`pending-${index}-${name}`}
              type="button"
              size="sm"
              variant="outline"
              aria-label={`Remove ${name}`}
              disabled={launched}
              onClick={() => removePending(index)}
            >
              {name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
})
