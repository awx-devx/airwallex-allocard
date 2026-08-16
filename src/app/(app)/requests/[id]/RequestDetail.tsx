'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { FieldValues, UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import { isApiError } from '@/client/api/errors'
import { useBudgetCategories } from '@/client/hooks/useBudget'
import { useProjectMembers } from '@/client/hooks/useMembers'
import {
  useCancelRequest,
  usePolicyPreview,
  useRequest,
  useSubmitRequest,
  useUpdateRequest,
} from '@/client/hooks/useRequests'
import { useMe } from '@/client/hooks/useSession'
import { applyServerErrorsFromApiError, useZodForm } from '@/client/lib/forms'
import {
  approvalProgress,
  canCancelRequest,
  canEditDraft,
  cardHref,
  checkingPolicyMessage,
  expiredRequestMessage,
  formatApprovalProgress,
  formatApprovalRequired,
  formatEscalatedAt,
  parseOptionalIdParam,
  POLICY_PREVIEW_DEBOUNCE_MS,
  policyPreviewFailedMessage,
  policyPreviewHeading,
  projectCardsHref,
  rejectedFallbackMessage,
  rejectionReason,
  requestListHref,
  requestNotFoundMessage,
  showLivePolicyDecision,
  unlockedCardMessage,
  unlockedNoneLinkedMessage,
} from '@/client/lib/requests'
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { Timeline } from '@/components/patterns/Timeline'
import type { TimelineItem } from '@/components/patterns/types'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { currencyExponent } from '@/shared/constants/currency'
import { ActorType } from '@/shared/enums/audit'
import { ErrorCode } from '@/shared/enums/errors'
import { PolicyOutcome } from '@/shared/enums/policyOutcome'
import { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'
import { parseMoneyInput } from '@/lib/money'
import { formatDate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { PolicyDecision, PurchaseRequest } from '@/shared/types/purchaseRequest'

const NONE = '__none__'

const draftFormSchema = z.object({
  vendor: z.string().min(1).max(200),
  amount: z.string().min(1),
  description: z.string().min(1).max(2000),
  justification: z.string().min(1).max(2000),
  categoryId: z.string().optional(),
})

function parsedAmountOrNull(raw: string, currency: string): number | null {
  try {
    return parseMoneyInput(raw, currency).amount
  } catch {
    return null
  }
}

function minorToInputString(amount: number, currency: string): string {
  const exp = currencyExponent(currency)
  if (exp === 0) {
    return String(amount)
  }
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)
  const factor = 10 ** exp
  const major = Math.trunc(abs / factor)
  const frac = abs % factor
  if (frac === 0) {
    return `${sign}${major}`
  }
  return `${sign}${major}.${String(frac).padStart(exp, '0')}`
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
  error?: string | null
}) {
  if (decision === null) {
    if (error !== undefined && error !== null && error.length >= 1) {
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

function UnlockedBlock({ request }: { request: PurchaseRequest }) {
  if (request.cardId !== null && request.cardId.length >= 1) {
    return (
      <p className="text-sm">
        {unlockedCardMessage()}{' '}
        <Link href={cardHref(request.cardId)} className="hover:underline">
          Open card
        </Link>
      </p>
    )
  }
  return (
    <p className="text-sm">
      {unlockedNoneLinkedMessage()}{' '}
      <Link href={projectCardsHref(request.projectId)} className="hover:underline">
        Project cards
      </Link>
    </p>
  )
}

function DraftEditor({ request }: { request: PurchaseRequest }) {
  const router = useRouter()
  const updateRequest = useUpdateRequest()
  const submitRequest = useSubmitRequest()
  const { mutate: previewMutate, isPending: previewMutating } = usePolicyPreview()
  const categoriesQuery = useBudgetCategories(request.projectId)
  const omitCategory =
    Boolean(categoriesQuery.error) &&
    isApiError(categoriesQuery.error) &&
    categoriesQuery.error.code === ErrorCode.PERMISSION_DENIED
  const generation = useRef(0)
  const [decision, setDecision] = useState<PolicyDecision | null>(null)
  const [previewSuccessKey, setPreviewSuccessKey] = useState('')
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [policyReasons, setPolicyReasons] = useState<string[]>([])
  const form = useZodForm(draftFormSchema, {
    defaultValues: {
      vendor: request.vendor,
      amount: minorToInputString(request.amount, request.currency),
      description: request.description,
      justification: request.justification,
      categoryId: request.categoryId ?? NONE,
    },
  })
  const amountRaw = form.watch('amount')
  const categoryId = form.watch('categoryId')
  const vendor = form.watch('vendor')
  const description = form.watch('description')
  const justification = form.watch('justification')
  const parsedAmount = parsedAmountOrNull(amountRaw, request.currency)
  const selectedCategory =
    categoryId !== undefined && categoryId.length >= 1 && categoryId !== NONE
      ? categoryId
      : undefined
  const fieldsReady =
    vendor.trim().length >= 1 &&
    description.trim().length >= 1 &&
    justification.trim().length >= 1 &&
    parsedAmount !== null &&
    parsedAmount >= 0
  const previewReady = parsedAmount !== null && parsedAmount >= 0
  const previewKey = previewReady
    ? `${request.projectId}:${parsedAmount}:${selectedCategory ?? ''}:${request.currency}`
    : ''
  const previewBusy = previewMutating || (previewReady && previewSuccessKey !== previewKey)
  const notPermitted = decision?.outcome === PolicyOutcome.NOT_PERMITTED
  const pendingWrite = updateRequest.isPending || submitRequest.isPending
  const submitDisabled = !fieldsReady || notPermitted || previewBusy || pendingWrite
  const draftDisabled = !fieldsReady || pendingWrite

  useEffect(() => {
    if (!previewReady || parsedAmount === null) {
      generation.current += 1
      return
    }
    const gen = ++generation.current
    const key = `${request.projectId}:${parsedAmount}:${selectedCategory ?? ''}:${request.currency}`
    const timer = window.setTimeout(() => {
      previewMutate(
        {
          projectId: request.projectId,
          amount: parsedAmount,
          currency: request.currency,
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
  }, [
    parsedAmount,
    previewMutate,
    previewReady,
    request.currency,
    request.projectId,
    selectedCategory,
  ])

  function handleWriteError(error: unknown) {
    if (isApiError(error) && error.code === ErrorCode.VALIDATION_FAILED) {
      applyServerErrorsFromApiError(form as unknown as UseFormReturn<FieldValues>, error)
      setPolicyReasons(policyReasonsFromError(error.details))
      setAlertMessage(error.message)
      return
    }
    setAlertMessage(isApiError(error) ? error.message : 'Unable to save request')
  }

  async function onSaveDraft() {
    if (parsedAmount === null) return
    setAlertMessage(null)
    setPolicyReasons([])
    try {
      await updateRequest.mutateAsync({
        id: request.id,
        input: {
          amount: parsedAmount,
          currency: request.currency,
          vendor: vendor.trim(),
          description: description.trim(),
          justification: justification.trim(),
          categoryId: selectedCategory ?? null,
        },
      })
    } catch (error) {
      handleWriteError(error)
    }
  }

  async function onSubmitRequest() {
    if (parsedAmount === null) return
    setAlertMessage(null)
    setPolicyReasons([])
    try {
      await updateRequest.mutateAsync({
        id: request.id,
        input: {
          amount: parsedAmount,
          currency: request.currency,
          vendor: vendor.trim(),
          description: description.trim(),
          justification: justification.trim(),
          categoryId: selectedCategory ?? null,
        },
      })
      await submitRequest.mutateAsync({ id: request.id })
    } catch (error) {
      handleWriteError(error)
    }
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
              <FormLabel>Amount ({request.currency})</FormLabel>
              <FormControl>
                <Input {...field} type="text" inputMode="decimal" />
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
          <Button type="submit" disabled={submitDisabled} loading={pendingWrite}>
            Submit request
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={draftDisabled}
            onClick={() => void onSaveDraft()}
          >
            Save draft
          </Button>
          <CancelRequestButton
            requestId={request.id}
            onCancelled={() => router.push(requestListHref({ projectId: request.projectId }))}
          />
        </div>
      </form>
    </Form>
  )
}

function CancelRequestButton({
  requestId,
  onCancelled,
}: {
  requestId: string
  onCancelled: () => void
}) {
  const cancelRequest = useCancelRequest()
  const [open, setOpen] = useState(false)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  async function onConfirm() {
    setAlertMessage(null)
    try {
      await cancelRequest.mutateAsync({ id: requestId })
      setOpen(false)
      onCancelled()
    } catch (error) {
      setAlertMessage(isApiError(error) ? error.message : 'Unable to cancel request')
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {alertMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{alertMessage}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
        Cancel request
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Cancel this request?"
        description="A reserved amount is released if one was committed."
        confirmLabel="Cancel request"
        variant="destructive"
        loading={cancelRequest.isPending}
        onConfirm={() => void onConfirm()}
      />
    </div>
  )
}

export function RequestDetail() {
  const router = useRouter()
  const raw = useParams().id
  const id = parseOptionalIdParam(
    typeof raw === 'string' ? raw : Array.isArray(raw) ? raw : undefined,
  )
  const me = useMe()
  const query = useRequest(id ?? '')
  const members = useProjectMembers(query.data?.projectId ?? '')
  const viewerId = me.data?.user.id

  if (!id) {
    return <ErrorState message={requestNotFoundMessage()} />
  }

  if (query.isPending) {
    return <LoadingState />
  }

  if (query.error) {
    if (isApiError(query.error) && query.error.code === ErrorCode.NOT_FOUND) {
      return <ErrorState message={requestNotFoundMessage()} />
    }
    return (
      <ErrorState
        message={isApiError(query.error) ? query.error.message : 'Unable to load request'}
      />
    )
  }

  const data = query.data
  const nameOf = new Map((members.data ?? []).map((member) => [member.userId, member.user.name]))
  const trail: TimelineItem[] = data.approvals.map((entry) => ({
    id: `${entry.approverId}-${entry.at}`,
    at: entry.at,
    actorType: ActorType.USER,
    actorId: entry.approverId,
    actorName: nameOf.get(entry.approverId) ?? entry.approverId,
    summary: entry.reason ? `${entry.decision}: ${entry.reason}` : entry.decision,
  }))
  const progress = approvalProgress(data)
  const rejected = rejectionReason(data.approvals)
  const editable = canEditDraft(data.status, data.requestedBy, viewerId)
  const cancellable = canCancelRequest(data.status, data.requestedBy, viewerId)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Link
        href={requestListHref({ projectId: data.projectId })}
        className={cn(buttonVariants({ variant: 'ghost' }), 'w-fit')}
      >
        Back
      </Link>
      <div className="flex min-w-0 flex-wrap gap-2">
        <h1 className="min-w-0 text-lg font-medium">{data.vendor}</h1>
        <StatusBadge kind="request" status={data.status} />
        <MoneyDisplay money={{ amount: data.amount, currency: data.currency }} />
      </div>
      <p className="min-w-0 break-words text-sm">{data.description}</p>
      <p className="min-w-0 break-words text-sm">{data.justification}</p>
      {data.status === PurchaseRequestStatus.REJECTED ? (
        <Alert variant="destructive">
          <AlertTitle>Rejected</AlertTitle>
          <AlertDescription>{rejected ?? rejectedFallbackMessage()}</AlertDescription>
        </Alert>
      ) : null}
      {data.status === PurchaseRequestStatus.EXPIRED ? (
        <Alert>
          <AlertDescription>{expiredRequestMessage()}</AlertDescription>
        </Alert>
      ) : null}
      {data.escalatedAt ? (
        <p className="text-sm">{formatEscalatedAt(data.escalatedAt, formatDate)}</p>
      ) : null}
      {data.policyDecision && showLivePolicyDecision(data.status) ? (
        <div className="flex min-w-0 flex-col gap-1">
          <PolicyPreviewPane decision={data.policyDecision} />
          {data.policyDecision.reasons.map((reason) =>
            data.policyDecision?.outcome === PolicyOutcome.NOT_PERMITTED ? null : (
              <p key={reason} className="text-sm">
                {reason}
              </p>
            ),
          )}
          {progress.required > 0 ? (
            <p className="text-sm">{formatApprovalProgress(progress)}</p>
          ) : null}
        </div>
      ) : null}
      <div className="min-w-0">
        <h2 className="mb-2 text-sm font-medium">Approval trail</h2>
        <Timeline items={trail} />
        {trail.length === 0 &&
        data.status === PurchaseRequestStatus.PENDING &&
        progress.required > 0 ? (
          <p className="text-sm">{formatApprovalProgress(progress)}</p>
        ) : null}
      </div>
      {data.status === PurchaseRequestStatus.APPROVED ? <UnlockedBlock request={data} /> : null}
      {editable ? <DraftEditor request={data} /> : null}
      {!editable && cancellable ? (
        <div className="flex flex-wrap gap-2">
          <CancelRequestButton
            requestId={data.id}
            onCancelled={() => router.push(requestListHref({ projectId: data.projectId }))}
          />
        </div>
      ) : null}
    </div>
  )
}
