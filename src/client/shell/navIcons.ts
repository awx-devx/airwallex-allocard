import type { LucideIcon } from 'lucide-react'
import {
  ActivityIcon,
  ArrowLeftRightIcon,
  ChartColumnIcon,
  ClipboardCheckIcon,
  CreditCardIcon,
  FileTextIcon,
  FolderKanbanIcon,
  HistoryIcon,
  HouseIcon,
  LayersIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  ReceiptIcon,
  ScrollTextIcon,
  ShieldIcon,
  SlidersHorizontalIcon,
  TagsIcon,
  UserCheckIcon,
  UsersIcon,
  WalletIcon,
  ZapIcon,
} from 'lucide-react'

/** SideNav + SettingsChrome — keyed by `href`. Do not put icons on DEFAULT_NAV / SETTINGS_NAV. */
export const NAV_ICONS: Record<string, LucideIcon> = {
  '/dashboard': LayoutDashboardIcon,
  '/projects': FolderKanbanIcon,
  '/cards': CreditCardIcon,
  '/requests': FileTextIcon,
  '/approvals': ClipboardCheckIcon,
  '/activity': ActivityIcon,
  '/transactions': ArrowLeftRightIcon,
  '/receipts': ReceiptIcon,
  '/automation': ZapIcon,
  '/reports': ChartColumnIcon,
  '/audit': ScrollTextIcon,
  '/settings/members': UsersIcon,
  '/settings/roles': ShieldIcon,
  '/settings/access-reviews': UserCheckIcon,
  '/settings/rules': ListChecksIcon,
  '/settings/attributes': TagsIcon,
}

/** Workspace tabs + budget chrome — keyed by visible label. */
export const CHROME_TAB_ICONS: Record<string, LucideIcon> = {
  Overview: HouseIcon,
  People: UsersIcon,
  Budget: WalletIcon,
  Cards: CreditCardIcon,
  Controls: SlidersHorizontalIcon,
  Activity: ActivityIcon,
  Categories: LayersIcon,
  History: HistoryIcon,
  Requests: FileTextIcon,
}

export function navIcon(href: string): LucideIcon | undefined {
  return NAV_ICONS[href]
}

export function chromeTabIcon(label: string): LucideIcon | undefined {
  return CHROME_TAB_ICONS[label]
}
