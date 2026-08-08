import { Permission } from '@/shared/enums/permissions'
import type { Permission as PermissionValue } from '@/shared/enums/permissions'

/** All permissions — Finance Administrator template. */
export const ALL_PERMISSIONS: readonly PermissionValue[] = Object.values(Permission)

export type RoleTemplateDefinition = {
  key: string
  name: string
  permissions: readonly PermissionValue[]
}

/**
 * Seven built-in role templates. Seeded as per-org copies (`isTemplate: true`).
 * Permission lists approved from PRD personas (no CSV in-repo).
 */
export const ROLE_TEMPLATES: readonly RoleTemplateDefinition[] = [
  {
    key: 'finance_administrator',
    name: 'Finance Administrator',
    permissions: ALL_PERMISSIONS,
  },
  {
    key: 'project_manager',
    name: 'Project Manager',
    permissions: [
      Permission.PROJECT_VIEW,
      Permission.PROJECT_EDIT,
      Permission.PROJECT_CREATE,
      Permission.PROJECT_CLOSE,
      Permission.BUDGET_VIEW,
      Permission.BUDGET_EDIT,
      Permission.MEMBER_VIEW,
      Permission.MEMBER_MANAGE,
      Permission.ROLE_ASSIGN,
      Permission.CARD_CREATE,
      Permission.CARD_VIEW,
      Permission.CARD_VIEW_DETAILS,
      Permission.CARD_MANAGE,
      Permission.CONTROL_EDIT,
      Permission.TRANSACTION_VIEW,
      Permission.REPORT_EXPORT,
    ],
  },
  {
    key: 'approver',
    name: 'Approver',
    permissions: [
      Permission.PROJECT_VIEW,
      Permission.BUDGET_VIEW,
      Permission.CARD_VIEW,
      Permission.REQUEST_APPROVE,
      Permission.TRANSACTION_VIEW,
    ],
  },
  {
    key: 'project_spender',
    name: 'Project Spender',
    permissions: [
      Permission.PROJECT_VIEW,
      Permission.BUDGET_VIEW,
      Permission.BUDGET_REQUEST,
      Permission.CARD_VIEW,
      Permission.CARD_VIEW_DETAILS,
      Permission.PAYMENT_MAKE,
      Permission.TRANSACTION_VIEW,
    ],
  },
  {
    key: 'procurement_lead',
    name: 'Procurement Lead',
    permissions: [
      Permission.PROJECT_VIEW,
      Permission.BUDGET_VIEW,
      Permission.CARD_CREATE,
      Permission.CARD_VIEW,
      Permission.CARD_VIEW_DETAILS,
      Permission.CARD_MANAGE,
      Permission.PAYMENT_MAKE,
      Permission.TRANSACTION_VIEW,
    ],
  },
  {
    key: 'contractor',
    name: 'Contractor',
    permissions: [
      Permission.PROJECT_VIEW,
      Permission.CARD_VIEW,
      Permission.CARD_VIEW_DETAILS,
      Permission.PAYMENT_MAKE,
      Permission.TRANSACTION_VIEW,
    ],
  },
  {
    key: 'viewer',
    name: 'Viewer',
    permissions: [
      Permission.PROJECT_VIEW,
      Permission.BUDGET_VIEW,
      Permission.CARD_VIEW,
      Permission.TRANSACTION_VIEW,
      Permission.REPORT_EXPORT,
    ],
  },
] as const
