/**
 * PCI boundary: sensitive details render in the Airwallex iframe only.
 */
'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { useCard, usePanToken } from '@/client/hooks/useCards'
import { useProject } from '@/client/hooks/useProjects'
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
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { PageFlow } from '@/components/patterns/PageBody'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { ErrorCode } from '@/shared/enums/errors'

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
          setToken(decision.token)
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
            setTokenError(null)
            setRetry((n) => n + 1)
          }}
        />
      </PageFlow>
    )
  }

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
      <div className="relative min-w-0">
        {iframeSrc ? (
          <iframe
            className="min-h-96 w-full border-0"
            title="Card details"
            referrerPolicy="no-referrer"
            src={iframeSrc}
            onLoad={() => setFrameReady(true)}
          />
        ) : (
          <LoadingState />
        )}
        {iframeSrc && !frameReady ? (
          <div className="absolute inset-0 bg-background/80">
            <LoadingState />
          </div>
        ) : null}
      </div>
    </PageFlow>
  )
}
