'use client'

import { useState } from 'react'
import { matchesConfirmPhrase } from '@/components/patterns/matchesConfirmPhrase'
import type { ConfirmDialogProps } from '@/components/patterns/types'
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

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  variant,
  typeToConfirm,
  onConfirm,
  loading,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('')
  const matched = typeToConfirm ? matchesConfirmPhrase(typed, typeToConfirm.phrase) : true
  const confirmDisabled = Boolean(loading) || (typeToConfirm ? !matched : false)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped('')
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {typeToConfirm ? (
          <div className="space-y-2">
            <Label htmlFor="confirm-phrase">{typeToConfirm.prompt}</Label>
            <Input
              id="confirm-phrase"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
            />
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            disabled={confirmDisabled}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
