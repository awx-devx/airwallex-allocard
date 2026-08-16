'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { FieldValues, UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import { isApiError } from '@/client/api/errors'
import { useBudgetCategories } from '@/client/hooks/useBudget'
import { useProjects } from '@/client/hooks/useProjects'
import { useCreateRequest, usePolicyPreview, useSubmitRequest } from '@/client/hooks/useRequests'
import { useMe } from '@/client/hooks/useSession'
import { applyServerErrorsFromApiError, useZodForm } from '@/client/lib/forms'
import { useCan } from '@/client/lib/permissions/useCan'
import {
  checkingPolicyMessage,
  createRequestDenialMessage,
  formatApprovalRequired,
  newRequestHref,
  parseOptionalIdParam,
  POLICY_PREVIEW_DEBOUNCE_MS,
  policyPreviewFailedMessage,
  policyPreviewHeading,
  requestHref,
  requestListHref,
} from '@/client/lib/requests'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { parseMoneyInput } from '@/lib/money'
import { ErrorCode } from '@/shared/enums/errors'
import { Permission } from '@/shared/enums/permissions'
import { PolicyOutcome } from '@/shared/enums/policyOutcome'
import type { PolicyDecision } from '@/shared/types/purchaseRequest'

const NONE = '__none__'

const requestFormSchema = z.object({
  vendor: z.string().min(1).max(200),
  amount: z.string().min(1),
  description: z.string().min(1).max(2000),
  justification: z.string().min(1).max(2000),
  categoryId: z.string().optional(),
})

function parsedAmountOrNull(raw: string, currency: string): number | null {
  try {
    const parsed = parseMoneyInput(raw, currency)
    return parsed.amount
  } catch {
    return null
  }
}

function policyReasonsFromError(details: unknown): string[] {
  if (typeof details !== 'object' || details === null) {
    return []
  }
  const record = details as { policy?: unknown; fieldErrors?: { policy?: unknown } }
  if (Array.isArray(record.policy) && record.policy.every((item) => typeof item === 'string')) {
    return record.policy
  }
  const fromFields = record.fieldErrors?.policy
  if (Array.isArray(fromFields) && fromFields.every((item) => typeof item === 'string')) {
    return fromFields
  }
  return []
}

function PolicyPreviewPane({
  decision,
  error,
}: {
  decision: PolicyDecision | null
  error: string | null
}) {
  if (decision === null) {
    if (error !== null && error.length >= 1) {
      return <p className="text-sm text-destructive">{error}</p>
    }
    return <p className="text-sm text-muted-foreground">{checkingPolicyMessage()}</p>
  }
  if (decision.outcome === PolicyOutcome.APPROVAL_REQUIRED) {
    return <p className="text-sm">{formatApprovalRequired(decision.requiredApprovals)}</p>
  }
  if (decision.outcome === PolicyOutcome.NOT_PERMITTED) {
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm font-medium">{policyPreviewHeading(decision.outcome)}</p>
        {decision.reasons.map((reason) => (
          <p key={reason} className="text-sm">
            {reason}
          </p>
        ))}
      </div>
    )
  }
  return <p className="text-sm">{policyPreviewHeading(decision.outcome)}</p>
}

export function RequestForm() {
  const router = useRouter()
  const params = useSearchParams()
  const me = useMe()
  const projects = useProjects({ page: 1, pageSize: 100 })
  const createRequest = useCreateRequest()
  const submitRequest = useSubmitRequest()
  const { mutate: previewMutate, isPending: previewMutating } = usePolicyPreview()
  const generation = useRef(0)
  const [projectId, setProjectId] = useState(
    () => parseOptionalIdParam(params.get('projectId') ?? undefined) ?? '',
  )
  const [decision, setDecision] = useState<PolicyDecision | null>(null)
  const [previewSuccessKey, setPreviewSuccessKey] = useState('')
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [policyReasons, setPolicyReasons] = useState<string[]>([])
  const { can, isLoading } = useCan(projectId)
  const viewerId = me.data?.user.id
  const gateReady = !isLoading && !me.isPending && viewerId !== undefined && viewerId.length >= 1
  const allowed = gateReady && can(Permission.PAYMENT_MAKE, { userId: viewerId })
  const categoriesQuery = useBudgetCategories(projectId)
  const omitCategory =
    Boolean(categoriesQuery.error) &&
    isApiError(categoriesQuery.error) &&
    categoriesQuery.error.code === ErrorCode.PERMISSION_DENIED

  const form = useZodForm(requestFormSchema, {
    defaultValues: {
      vendor: '',
      amount: '',
      description: '',
      justification: '',
      categoryId: NONE,
    },
  })

  const amountRaw = form.watch('amount')
  const categoryId = form.watch('categoryId')
  const vendor = form.watch('vendor')
  const description = form.watch('description')
  const justification = form.watch('justification')
  const currency = me.data?.activeOrg?.baseCurrency ?? ''
  const parsedAmount = currency.length === 3 ? parsedAmountOrNull(amountRaw, currency) : null
  const fieldsReady =
    vendor.trim().length >= 1 &&
    description.trim().length >= 1 &&
    justification.trim().length >= 1 &&
    parsedAmount !== null &&
    parsedAmount >= 0
  const previewReady = projectId.length >= 1 && parsedAmount !== null && parsedAmount >= 0
  const selectedCategory =
    categoryId !== undefined && categoryId.length >= 1 && categoryId !== NONE
      ? categoryId
      : undefined
  const previewKey = previewReady
    ? `${projectId}:${parsedAmount}:${selectedCategory ?? ''}:${currency}`
    : ''
  const previewBusy = previewMutating || (previewReady && previewSuccessKey !== previewKey)
  const notPermitted = decision?.outcome === PolicyOutcome.NOT_PERMITTED
  const pendingWrite = createRequest.isPending || submitRequest.isPending
  const submitDisabled =
    !allowed ||
    !fieldsReady ||
    projectId.length < 1 ||
    parsedAmount === null ||
    notPermitted ||
    previewBusy ||
    pendingWrite
  const draftDisabled = !allowed || !fieldsReady || projectId.length < 1 || pendingWrite

  useEffect(() => {
    if (!previewReady || currency.length !== 3 || parsedAmount === null) {
      generation.current += 1
      return
    }
    const gen = ++generation.current
    const key = `${projectId}:${parsedAmount}:${selectedCategory ?? ''}:${currency}`
    const timer = window.setTimeout(() => {
      previewMutate(
        {
          projectId,
          amount: parsedAmount,
          currency,
          ...(selectedCategory !== undefined ? { categoryId: selectedCategory } : {}),
        },
        {
          onSuccess: (data) => {
            if (gen !== generation.current) return
            setPreviewError(null)
            setDecision(data)
            setPreviewSuccessKey(key)
          },
          onError: (error) => {
            if (gen !== generation.current) return
            setDecision(null)
            setPreviewError(isApiError(error) ? error.message : policyPreviewFailedMessage())
            setPreviewSuccessKey(key)
          },
        },
      )
    }, POLICY_PREVIEW_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [currency, parsedAmount, previewMutate, previewReady, projectId, selectedCategory])

  function selectProject(nextId: string) {
    setProjectId(nextId)
    setDecision(null)
    setPreviewError(null)
    setPreviewSuccessKey('')
    router.replace(newRequestHref(nextId))
  }

  async function createDraft() {
    if (currency.length !== 3 || parsedAmount === null || projectId.length < 1) {
      return null
    }
    return createRequest.mutateAsync({
      id: projectId,
      input: {
        amount: parsedAmount,
        currency,
        vendor: vendor.trim(),
        description: description.trim(),
        justification: justification.trim(),
        ...(selectedCategory !== undefined ? { categoryId: selectedCategory } : {}),
      },
    })
  }

  function handleWriteError(error: unknown, createdId?: string) {
    if (isApiError(error) && error.code === ErrorCode.VALIDATION_FAILED) {
      applyServerErrorsFromApiError(form as unknown as UseFormReturn<FieldValues>, error)
      setPolicyReasons(policyReasonsFromError(error.details))
      setAlertMessage(error.message)
      if (createdId !== undefined && createdId.length >= 1) {
        router.replace(requestHref(createdId))
      }
      return
    }
    setAlertMessage(isApiError(error) ? error.message : 'Unable to save request')
  }

  async function onSubmitRequest() {
    setAlertMessage(null)
    setPolicyReasons([])
    try {
      const created = await createDraft()
      if (created === null) return
      try {
        await submitRequest.mutateAsync({ id: created.id })
        router.replace(requestHref(created.id))
      } catch (error) {
        handleWriteError(error, created.id)
      }
    } catch (error) {
      handleWriteError(error)
    }
  }

  async function onSaveDraft() {
    setAlertMessage(null)
    setPolicyReasons([])
    try {
      const created = await createDraft()
      if (created === null) return
      router.replace(requestHref(created.id))
    } catch (error) {
      handleWriteError(error)
    }
  }

  if (me.isPending) {
    return <LoadingState />
  }

  if (currency.length !== 3) {
    return <ErrorState message="Unable to load" />
  }

  return (
    <Form {...form}>
      <form
        className="flex min-w-0 flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void onSubmitRequest()
        }}
      >
        {alertMessage ? (
          <Alert variant="destructive">
            {policyReasons.length > 0 ? (
              <>
                <AlertTitle>{alertMessage}</AlertTitle>
                <AlertDescription className="flex min-w-0 flex-col gap-1">
                  {policyReasons.map((reason) => (
                    <span key={reason}>{reason}</span>
                  ))}
                </AlertDescription>
              </>
            ) : (
              <AlertDescription>{alertMessage}</AlertDescription>
            )}
          </Alert>
        ) : null}
        <div className="flex min-w-0 flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Project</Label>
          <Select
            value={projectId.length >= 1 ? projectId : undefined}
            onValueChange={selectProject}
          >
            <SelectTrigger aria-label="Project">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {(projects.data?.items ?? []).map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <FormField
          control={form.control}
          name="vendor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vendor</FormLabel>
              <FormControl>
                <Input {...field} maxLength={200} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount ({currency})</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="text"
                  inputMode="decimal"
                  onBlur={(event) => {
                    field.onBlur()
                    parsedAmountOrNull(event.target.value, currency)
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {omitCategory ? null : (
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select
                  value={field.value && field.value.length >= 1 ? field.value : NONE}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger aria-label="Category">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {(categoriesQuery.data ?? []).map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} maxLength={2000} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="justification"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Justification</FormLabel>
              <FormControl>
                <Textarea {...field} maxLength={2000} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {previewReady ? (
          <div className="min-w-0">
            <PolicyPreviewPane
              decision={previewBusy ? null : decision}
              error={previewBusy ? null : previewError}
            />
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {gateReady ? (
            <PermissionGateView allowed={allowed} denialMessage={createRequestDenialMessage()}>
              <Button type="submit" disabled={submitDisabled} loading={pendingWrite}>
                Submit request
              </Button>
            </PermissionGateView>
          ) : (
            <Button type="submit" disabled>
              Submit request
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={draftDisabled}
            onClick={() => void onSaveDraft()}
          >
            Save draft
          </Button>
          <Link
            href={requestListHref({ projectId: projectId.length >= 1 ? projectId : undefined })}
            className={buttonVariants({ variant: 'ghost' })}
          >
            Cancel
          </Link>
        </div>
      </form>
    </Form>
  )
}
