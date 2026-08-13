/**
 * PermissionGate / PermissionGateView are UX only, never a security control.
 * Server `requirePermission` is authoritative.
 *
 * Unlike RequirePermission (default `null` when denied), Gate always explains
 * the denial with a tooltip — it never silently hides the control.
 */
export type PermissionGateViewDecision = 'children' | 'tooltip-fallback' | 'tooltip-children'

export function decidePermissionGateView(input: {
  allowed: boolean
  hasFallback: boolean
}): PermissionGateViewDecision {
  if (input.allowed) return 'children'
  return input.hasFallback ? 'tooltip-fallback' : 'tooltip-children'
}
