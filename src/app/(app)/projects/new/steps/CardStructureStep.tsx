'use client'

/** Card structure flags only — never a PAN. */

import Link from 'next/link'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { useProject, useUpdateProject } from '@/client/hooks/useProjects'
import { projectCardsHref } from '@/client/lib/cards'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export type CardStructureStepHandle = {
  submit: () => Promise<boolean>
}

const FLAGS = [
  { key: 'shared', label: 'Shared' },
  { key: 'perMember', label: 'Per-member' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'oneTime', label: 'One-time' },
] as const

export const CardStructureStep = forwardRef<
  CardStructureStepHandle,
  { draftId: string; onDirtyChange: (dirty: boolean) => void }
>(function CardStructureStep({ draftId, onDirtyChange }, ref) {
  const projectQuery = useProject(draftId)
  const update = useUpdateProject()
  const project = projectQuery.data
  const [shared, setShared] = useState(false)
  const [perMember, setPerMember] = useState(false)
  const [vendor, setVendor] = useState(false)
  const [oneTime, setOneTime] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (!project || hydrated) return
    setShared(project.cardStructure.shared)
    setPerMember(project.cardStructure.perMember)
    setVendor(project.cardStructure.vendor)
    setOneTime(project.cardStructure.oneTime)
    setHydrated(true)
  }, [hydrated, project])

  const values = { shared, perMember, vendor, oneTime }
  const setters = {
    shared: setShared,
    perMember: setPerMember,
    vendor: setVendor,
    oneTime: setOneTime,
  }

  useEffect(() => {
    if (!project) {
      onDirtyChange(false)
      return
    }
    const cs = project.cardStructure
    onDirtyChange(
      shared !== cs.shared ||
        perMember !== cs.perMember ||
        vendor !== cs.vendor ||
        oneTime !== cs.oneTime,
    )
  }, [onDirtyChange, perMember, project, shared, oneTime, vendor])

  async function submit(): Promise<boolean> {
    setErrorMessage(null)
    try {
      await update.mutateAsync({ id: draftId, input: { cardStructure: values } })
      return true
    } catch (error) {
      setErrorMessage(isApiError(error) ? error.message : 'Unable to save card structure')
      return false
    }
  }

  useImperativeHandle(ref, () => ({ submit }))

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {errorMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
      {FLAGS.map((flag) => (
        <div key={flag.key} className="flex items-center gap-3">
          <Switch id={flag.key} checked={values[flag.key]} onCheckedChange={setters[flag.key]} />
          <Label htmlFor={flag.key}>{flag.label}</Label>
        </div>
      ))}
      {draftId.length >= 1 ? (
        <Link href={projectCardsHref(draftId)} className={buttonVariants({ variant: 'outline' })}>
          Issue and manage cards on the project cards tab.
        </Link>
      ) : null}
    </div>
  )
})
