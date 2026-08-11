'use client'

import { useCallback, useMemo, useState } from 'react'

export type DisclosureState = {
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  onToggle: () => void
  setOpen: (value: boolean) => void
}

/** Pure reducer-style helpers — test without React. */
export function createDisclosureState(isOpen: boolean): DisclosureState {
  return {
    isOpen,
    onOpen: () => undefined,
    onClose: () => undefined,
    onToggle: () => undefined,
    setOpen: () => undefined,
  }
}

export function disclosureReducer(
  state: boolean,
  action: 'open' | 'close' | 'toggle' | boolean,
): boolean {
  if (action === 'open') return true
  if (action === 'close') return false
  if (action === 'toggle') return !state
  return action
}

export function useDisclosure(initial = false): DisclosureState {
  const [isOpen, setIsOpen] = useState(initial)

  const onOpen = useCallback(() => {
    setIsOpen(true)
  }, [])
  const onClose = useCallback(() => {
    setIsOpen(false)
  }, [])
  const onToggle = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])
  const setOpen = useCallback((value: boolean) => {
    setIsOpen(value)
  }, [])

  return useMemo(
    () => ({ isOpen, onOpen, onClose, onToggle, setOpen }),
    [isOpen, onOpen, onClose, onToggle, setOpen],
  )
}
