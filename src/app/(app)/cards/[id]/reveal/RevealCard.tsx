/**
 * Organisation cards: number / expiry / security code from GET details (never persisted).
 * Leftover individual cards: sensitive details render in the Airwallex iframe only.
 */
'use client'

import { CopyIcon } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { useCard, usePanToken } from '@/client/hooks/useCards'
import { useProject } from '@/client/hooks/useProjects'
import { copyToClipboard } from '@/client/lib/clipboard'
import {
  airwallexRevealIframeSrc,
  canRevealCard,
  cardHref,
  classifyPanTokenResult,
  classifyRevealMessage,
  iframeErrorMessage,
  iframePendingMessage,
  isAirwallexPciOrigin,
  isPendingAirwallexId,
  revealAuditedMessage,
} from '@/client/lib/cards'
import { archivedProjectMessage, isProjectArchived } from '@/client/lib/reports'
import { CardVisual } from '@/components/patterns/CardVisual'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { PageFlow } from '@/components/patterns/PageBody'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { ErrorCode } from '@/shared/enums/errors'

type DirectReveal = {
  number: string
  cvv: string
  expiryMonth: string
  expiryYear: string
}

function expiryLabel(month: string, year: string): string {
  const mm = month.padStart(2, '0')
  const yy = year.length === 4 ? year.slice(2) : year
  return `${mm}/${yy}`
}

function groupDigits(value: string): string {
  return value
    .replace(/\s+/g, '')
    .replace(/(.{4})(?=.)/g, '$1 ')
    .trim()
}

function CopyRow({ label, value, display }: { label: string; value: string; display?: string }) {
  const shown = display ?? value
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[0.625rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          {label}
        </p>
        <p className="truncate font-mono text-sm tabular-nums" title={shown}>
          {shown}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`Copy ${label}`}
        onClick={() => {
          void copyToClipboard(value)
        }}
      >
        <CopyIcon aria-hidden />
      </Button>
    </div>
  )
}

export function RevealCard() {
  const raw = useParams().id
  const id = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : ''
  const cardQuery = useCard(id)
  const project = useProject(cardQuery.data?.projectId ?? '')
  const { mutateAsync } = usePanToken()
  const generation = useRef(0)
  const expiryRetried = useRef(false)
  const [retry, setRetry] = useState(0)
  const [token, setToken] = useState<string | null>(null)
  const [direct, setDirect] = useState<DirectReveal | null>(null)
  const [frameReady, setFrameReady] = useState(false)
  const [frameError, setFrameError] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)

  const card = cardQuery.data
  const archived = isProjectArchived(project.data?.status ?? '')
  const eligible =
    card !== undefined && !archived && canRevealCard(card.status, card.airwallexCardId)

  useEffect(() => {
    if (!eligible || !id) return
    const gen = ++generation.current
    if (retry === 0) {
      expiryRetried.current = false
    }

    async function run() {
      try {
        const first = await mutateAsync({ id })
        if (gen !== generation.current) return
        let decision = classifyPanTokenResult(first, Date.now(), expiryRetried.current)
        if (decision.kind === 'retry') {
          expiryRetried.current = true
          const refreshed = await mutateAsync({ id })
          if (gen !== generation.current) return
          decision = classifyPanTokenResult(refreshed, Date.now(), true)
        }
        if (gen !== generation.current) return
        if (decision.kind === 'ok') {
          setDirect(null)
          setToken(decision.token)
          return
        }
        if (decision.kind === 'direct') {
          setToken(null)
          setDirect({
            number: decision.number,
            cvv: decision.cvv,
            expiryMonth: decision.expiryMonth,
            expiryYear: decision.expiryYear,
          })
          return
        }
        setTokenError(iframeErrorMessage())
      } catch (error: unknown) {
        if (gen !== generation.current) return
        setTokenError(isApiError(error) ? error.message : iframeErrorMessage())
      }
    }

    void run()
    return () => {
      generation.current += 1
    }
  }, [eligible, id, mutateAsync, retry])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!isAirwallexPciOrigin(event.origin)) return
      const kind = classifyRevealMessage(event.data)
      if (kind === 'error') {
        setFrameError(true)
      } else if (kind === 'ready') {
        setFrameReady(true)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  if (!id) {
    return <ErrorState message="This card is not available." />
  }

  if (cardQuery.isPending) {
    return <LoadingState />
  }

  if (cardQuery.error) {
    if (isApiError(cardQuery.error) && cardQuery.error.code === ErrorCode.NOT_FOUND) {
      return <ErrorState message="This card is not available." />
    }
    return (
      <ErrorState
        message={isApiError(cardQuery.error) ? cardQuery.error.message : 'Unable to load card'}
      />
    )
  }

  if (card === undefined) {
    return <ErrorState message="This card is not available." />
  }

  const back = (
    <Link href={cardHref(id)} className={buttonVariants({ variant: 'ghost' })}>
      Back
    </Link>
  )

  if (archived) {
    return (
      <PageFlow>
        {back}
        <Alert>
          <AlertDescription>{archivedProjectMessage()}</AlertDescription>
        </Alert>
      </PageFlow>
    )
  }

  if (!eligible || isPendingAirwallexId(card.airwallexCardId)) {
    return (
      <PageFlow>
        {back}
        <ErrorState message={iframePendingMessage()} />
      </PageFlow>
    )
  }

  if (frameError || tokenError) {
    return (
      <PageFlow>
        {back}
        <Alert>
          <AlertDescription>{revealAuditedMessage()}</AlertDescription>
        </Alert>
        <ErrorState
          message={tokenError ?? iframeErrorMessage()}
          onRetry={() => {
            expiryRetried.current = false
            setFrameError(false)
            setFrameReady(false)
            setToken(null)
            setDirect(null)
            setTokenError(null)
            setRetry((n) => n + 1)
          }}
        />
      </PageFlow>
    )
  }

  const expiry = direct !== null ? expiryLabel(direct.expiryMonth, direct.expiryYear) : undefined
  const iframeSrc =
    token !== null && token.length >= 1
      ? airwallexRevealIframeSrc(card.airwallexCardId, token)
      : null

  return (
    <PageFlow>
      {back}
      <Alert>
        <AlertDescription>{revealAuditedMessage()}</AlertDescription>
      </Alert>
      <div className="flex w-full min-w-0 max-w-sm flex-col gap-4">
        <CardVisual
          nickName={card.nickName}
          maskedNumber={direct?.number ?? card.maskedNumber}
          status={card.status}
          purpose={card.purpose}
          validThru={expiry}
        />
        {direct !== null ? (
          <div className="flex min-w-0 flex-col gap-3">
            <CopyRow label="Number" value={direct.number} display={groupDigits(direct.number)} />
            <CopyRow label="Expiry" value={expiry ?? ''} />
            <CopyRow label="Security code" value={direct.cvv} />
          </div>
        ) : iframeSrc ? (
          <div className="relative min-w-0">
            <iframe
              className="min-h-96 w-full border-0"
              title="Card details"
              referrerPolicy="no-referrer"
              src={iframeSrc}
              onLoad={() => setFrameReady(true)}
            />
            {!frameReady ? (
              <div className="absolute inset-0 bg-background/80">
                <LoadingState />
              </div>
            ) : null}
          </div>
        ) : (
          <LoadingState />
        )}
      </div>
    </PageFlow>
  )
}
