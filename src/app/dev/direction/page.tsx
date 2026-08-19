'use client'

import Image from 'next/image'
import { useState } from 'react'
import {
  ActivityIcon,
  BellIcon,
  ClipboardCheckIcon,
  CreditCardIcon,
  FolderKanbanIcon,
  HouseIcon,
  LayoutDashboardIcon,
  MenuIcon,
  PlusIcon,
  SearchIcon,
  TriangleAlertIcon,
  UsersIcon,
  WalletIcon,
} from 'lucide-react'
import { BrandWordmark } from '@/client/shell/BrandWordmark'
import { ThemeToggle } from '@/client/shell/ThemeToggle'
import { WalkCrowd } from '@/client/shell/WalkCrowd'
import { publicAsset } from '@/lib/assets'

type WorkspaceTab = 'overview' | 'budget' | 'cards'

const NAV: {
  id: string
  label: string
  icon: typeof LayoutDashboardIcon
  current?: boolean
  badge?: number
}[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboardIcon },
  { id: 'projects', label: 'Projects', icon: FolderKanbanIcon, current: true },
  { id: 'cards', label: 'Cards', icon: CreditCardIcon },
  { id: 'approvals', label: 'Approvals', icon: ClipboardCheckIcon, badge: 3 },
  { id: 'activity', label: 'Activity', icon: ActivityIcon },
]

const TABS: { id: WorkspaceTab; label: string; icon: typeof HouseIcon }[] = [
  { id: 'overview', label: 'Overview', icon: HouseIcon },
  { id: 'budget', label: 'Budget', icon: WalletIcon },
  { id: 'cards', label: 'Cards', icon: CreditCardIcon },
]

const CSS = `
.proposal {
  color: var(--foreground);
  font-family: system-ui, sans-serif;
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: var(--background);
}


.proposal *,
.proposal *::before,
.proposal *::after { box-sizing: border-box; }

.proposal button { font: inherit; color: inherit; }
.proposal .p-num { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum'; }

.proposal .p-shell {
  display: flex;
  height: 100dvh;
  overflow: hidden;
  color: var(--foreground);
}

.proposal .p-aside {
  display: none;
  width: 14.5rem;
  min-height: 0;
  flex-shrink: 0;
  flex-direction: column;
  background: linear-gradient(180deg, hsl(var(--gloss-highlight) / 0.04), transparent 28%), var(--sidebar);
  color: var(--sidebar-foreground);
  box-shadow: inset -1px 0 0 hsl(var(--gloss-highlight) / 0.06);
}

.proposal .p-aside-brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.9rem 0.85rem 0.75rem;
  flex-shrink: 0;
}

.proposal .p-aside-brand img {
  height: 1.75rem;
  width: auto;
  border-radius: var(--radius-chip);
}

.proposal .p-org {
  margin: 0 0.65rem 0.75rem;
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.55rem;
  border: 0;
  border-radius: var(--radius);
  background: hsl(var(--gloss-highlight) / 0.04);
  color: var(--sidebar-foreground);
  text-align: left;
  cursor: pointer;
  position: relative;
}

.proposal .p-org:hover { background: var(--sidebar-accent); }
.proposal .p-org-mark {
  display: grid;
  place-items: center;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: var(--radius-chip);
  background: hsl(var(--laser) / 0.18);
  color: hsl(var(--laser));
  font-size: 0.65rem;
  font-weight: 700;
  flex-shrink: 0;
}
.proposal .p-org-copy { min-width: 0; flex: 1; }
.proposal .p-org-copy strong { display: block; font-size: 0.75rem; font-weight: 600; }
.proposal .p-org-copy span { display: block; font-size: 0.65rem; color: color-mix(in srgb, var(--sidebar-foreground) 70%, transparent); }

.proposal .p-nav {
  margin: 0;
  padding: 0 0.55rem 1rem;
  list-style: none;
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.proposal .p-nav button {
  position: relative;
  display: flex;
  width: 100%;
  height: 2rem;
  align-items: center;
  gap: 0.55rem;
  padding: 0 0.55rem;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: color-mix(in srgb, var(--sidebar-foreground) calc(0.55 * 100%), transparent);
  font-size: 0.8125rem;
  cursor: pointer;
}
.proposal .p-nav button:hover {
  background: var(--sidebar-accent);
  color: var(--sidebar-foreground);
}
.proposal .p-nav button.is-current {
  background: var(--sidebar-accent);
  color: var(--sidebar-foreground);
}
.proposal .p-nav button.is-current::before,
.proposal .p-nav button.is-current::after {
  content: '';
  pointer-events: none;
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  mask-image: linear-gradient(180deg, transparent 0%, black 32%, black 68%, transparent 100%);
}
.proposal .p-nav button.is-current::before {
  width: 6px;
  background: linear-gradient(180deg, transparent, hsl(var(--laser)) 50%, transparent);
  opacity: 0.28;
  filter: blur(4px);
}
.proposal .p-nav button.is-current::after {
  width: 1px;
  background: linear-gradient(
    180deg,
    transparent 0%,
    hsl(var(--laser) / 0.35) 28%,
    hsl(var(--laser) / 0.85) 50%,
    hsl(var(--laser) / 0.35) 72%,
    transparent 100%
  );
  box-shadow: 0 0 4px 0 hsl(var(--laser) / 0.28);
}
.proposal .p-nav-badge {
  margin-left: auto;
  min-width: 1.15rem;
  height: 1.15rem;
  padding: 0 0.3rem;
  border-radius: var(--radius-chip);
  background: hsl(var(--laser));
  color: hsl(var(--gloss-highlight));
  font-size: 0.65rem;
  font-weight: 600;
  display: grid;
  place-items: center;
}

.proposal .p-maincol {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}


.proposal .p-header,
.proposal .p-page { position: relative; z-index: 1; }

.proposal .p-header {
  position: relative;
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem 1rem;
  background: color-mix(in srgb, var(--card) calc(0.42 * 100%), transparent);
  backdrop-filter: blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  box-shadow: inset 0 1px 0 hsl(var(--gloss-highlight) / 0.45);
}
.dark .proposal .p-header {
  background: hsl(var(--gloss-highlight) / 0.035);
  box-shadow: inset 0 1px 0 hsl(var(--gloss-highlight) / 0.08);
}
.proposal .p-header::after {
  content: '';
  pointer-events: none;
  position: absolute;
  left: 18%;
  right: 18%;
  bottom: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    hsl(var(--laser-cool) / 0.18) 24%,
    hsl(var(--laser) / 0.45) 50%,
    hsl(var(--laser-cool) / 0.18) 76%,
    transparent
  );
  box-shadow: 0 0 4px hsl(var(--laser) / 0.16);
}
.proposal .p-crumbs {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8125rem;
  color: var(--muted-foreground);
}
.proposal .p-crumbs b { color: var(--foreground); font-weight: 600; }
.proposal .p-header-actions {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: end;
  gap: 0.5rem;
}

.proposal .p-page {
  min-width: 0;
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 1rem 1rem 3.25rem;
}

.proposal .p-banner {
  position: relative;
  margin-bottom: 1rem;
  padding: 0.7rem 0.9rem;
  font-size: 0.8125rem;
  color: var(--muted-foreground);
}
.proposal .p-banner strong { color: var(--foreground); }

.proposal .p-glass {
  position: relative;
  border-radius: var(--radius);
  background: linear-gradient(180deg, hsl(var(--gloss-highlight) / 0.62), color-mix(in srgb, var(--card) calc(0.48 * 100%), transparent));
  backdrop-filter: blur(22px) saturate(1.45);
  -webkit-backdrop-filter: blur(22px) saturate(1.45);
  box-shadow:
    inset 0 1px 0 hsl(var(--gloss-highlight) / 0.55),
    0 1px 2px color-mix(in srgb, var(--foreground) calc(0.05 * 100%), transparent),
    0 16px 36px color-mix(in srgb, var(--foreground) calc(0.06 * 100%), transparent);
}
.dark .proposal .p-glass {
  background: linear-gradient(180deg, hsl(var(--gloss-highlight) / 0.07), color-mix(in srgb, var(--card) calc(0.55 * 100%), transparent));
  box-shadow:
    inset 0 1px 0 hsl(var(--gloss-highlight) / 0.1),
    0 1px 2px color-mix(in srgb, var(--foreground) calc(0.4 * 100%), transparent),
    0 18px 40px color-mix(in srgb, var(--foreground) calc(0.35 * 100%), transparent);
}
.proposal .p-glass::before {
  content: '';
  pointer-events: none;
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(
    165deg,
    hsl(var(--gloss-highlight) / 0.5) 0%,
    hsl(var(--laser-cool) / 0.18) 22%,
    color-mix(in srgb, var(--border) calc(0.35 * 100%), transparent) 55%,
    hsl(var(--laser) / 0.08) 88%,
    hsl(var(--gloss-highlight) / 0.05) 100%
  );
  mask: linear-gradient(black 0 0) content-box, linear-gradient(black 0 0);
  mask-composite: exclude;
  -webkit-mask: linear-gradient(black 0 0) content-box, linear-gradient(black 0 0);
  -webkit-mask-composite: xor;
}

.proposal .p-laser-cap::after {
  content: '';
  pointer-events: none;
  position: absolute;
  top: 0;
  left: 22%;
  right: 22%;
  height: 1px;
  z-index: 1;
  background: linear-gradient(
    90deg,
    transparent,
    hsl(var(--laser) / 0.12) 22%,
    hsl(var(--laser) / 0.55) 50%,
    hsl(var(--laser) / 0.12) 78%,
    transparent
  );
  box-shadow: 0 0 4px hsl(var(--laser) / 0.18);
}

.proposal .p-kicker {
  margin: 0 0 0.2rem;
  font-size: 0.625rem;
  font-weight: 650;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}
.proposal .p-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.proposal .p-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.proposal .p-stack { display: flex; flex-direction: column; gap: 1rem; }

.proposal .p-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  height: 2rem;
  padding: 0 0.75rem;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 550;
  white-space: nowrap;
}
.proposal .p-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--background), 0 0 0 3px hsl(var(--laser) / 0.45);
}
.proposal .p-btn-primary {
  background: var(--primary);
  color: var(--primary-foreground);
  box-shadow:
    inset 0 1px 0 hsl(var(--gloss-highlight) / 0.28),
    0 1px 2px color-mix(in srgb, var(--foreground) calc(0.28 * 100%), transparent),
    0 0 0 1px hsl(var(--laser) / 0.22);
}
.proposal .p-btn-primary:hover { filter: brightness(1.08); }
.proposal .p-btn-ghost {
  color: var(--foreground);
}
.proposal .p-btn-ghost:hover { background: color-mix(in srgb, var(--border) calc(0.25 * 100%), transparent); }
.proposal .p-btn-outline {
  background: color-mix(in srgb, var(--card) calc(0.4 * 100%), transparent);
  box-shadow: inset 0 1px 0 hsl(var(--gloss-highlight) / 0.4);
}
.proposal .p-btn-outline::before {
  content: '';
  pointer-events: none;
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(180deg, hsl(var(--gloss-highlight) / 0.45), hsl(var(--laser) / 0.12));
  mask: linear-gradient(black 0 0) content-box, linear-gradient(black 0 0);
  mask-composite: exclude;
  -webkit-mask: linear-gradient(black 0 0) content-box, linear-gradient(black 0 0);
  -webkit-mask-composite: xor;
}
.proposal .p-btn-icon { width: 2rem; padding: 0; }

.proposal .p-chip {
  display: inline-flex;
  align-items: center;
  height: 1.25rem;
  padding: 0 0.4rem;
  border-radius: var(--radius-chip);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  box-shadow: inset 0 1px 0 hsl(var(--gloss-highlight) / 0.28);
}
.proposal .p-chip-ok { background: hsl(var(--status-success)); color: hsl(var(--status-success-foreground)); }
.proposal .p-chip-info { background: hsl(var(--status-info)); color: hsl(var(--status-info-foreground)); }
.proposal .p-chip-warn { background: hsl(var(--status-warning)); color: hsl(var(--status-warning-foreground)); }

.proposal .p-input {
  height: 2rem;
  width: 100%;
  min-width: 0;
  padding: 0 0.65rem 0 1.85rem;
  border: 0;
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--card) calc(0.55 * 100%), transparent);
  color: var(--foreground);
  font-size: 0.8125rem;
  box-shadow:
    inset 0 1px 2px color-mix(in srgb, var(--foreground) calc(0.06 * 100%), transparent),
    0 0 0 1px color-mix(in srgb, var(--border) calc(0.7 * 100%), transparent);
}
.proposal .p-input::placeholder { color: var(--muted-foreground); }
.proposal .p-input:focus {
  outline: none;
  box-shadow:
    inset 0 1px 2px color-mix(in srgb, var(--foreground) calc(0.06 * 100%), transparent),
    0 0 0 1px hsl(var(--laser) / 0.4);
}
.proposal .p-search { position: relative; min-width: 0; flex: 1; }
.proposal .p-search svg {
  position: absolute;
  left: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted-foreground);
}

.proposal .p-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem;
  padding: 0.2rem;
  width: fit-content;
}
.proposal .p-tab {
  height: 1.75rem;
  padding: 0 0.65rem;
  border: 0;
  border-radius: var(--radius-chip);
  background: transparent;
  color: var(--muted-foreground);
  font-size: 0.75rem;
  font-weight: 550;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.proposal .p-tab.is-current {
  color: var(--foreground);
  background: hsl(var(--gloss-highlight) / 0.45);
  box-shadow: 0 0 0 1px hsl(var(--laser) / 0.22);
}
.dark .proposal .p-tab.is-current { background: hsl(var(--gloss-highlight) / 0.08); }

.proposal .p-kpis {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}
.proposal .p-kpi { padding: 0.9rem 1rem; min-width: 0; }
.proposal .p-kpi .p-num {
  display: block;
  margin-top: 0.35rem;
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.1;
}
.proposal .p-kpi-sub { margin: 0.35rem 0 0; font-size: 0.75rem; color: var(--muted-foreground); }

.proposal .p-meter { padding: 0.95rem 1rem; min-width: 0; }
.proposal .p-track {
  margin-top: 0.7rem;
  height: 0.4rem;
  border-radius: 1px;
  background: hsl(var(--budget-remaining));
  overflow: hidden;
  display: flex;
}
.proposal .p-track span { display: block; height: 100%; }
.proposal .p-seg-actual { background: hsl(var(--budget-actual)); width: 44.3%; }
.proposal .p-seg-commit { background: hsl(var(--status-info)); width: 36.8%; }
.proposal .p-legend {
  margin: 0.65rem 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  font-size: 0.75rem;
  color: var(--muted-foreground);
}
.proposal .p-swatch {
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  margin-right: 0.35rem;
  border-radius: 1px;
  vertical-align: middle;
}

.proposal .p-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}
.proposal .p-panel { padding: 0.9rem 1rem; min-width: 0; }
.proposal .p-panel h3 {
  margin: 0 0 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
}

.proposal .p-table-wrap { overflow-x: auto; }
.proposal .p-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}
.proposal .p-table th {
  text-align: left;
  font-size: 0.625rem;
  font-weight: 650;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-foreground);
  padding: 0.35rem 0.6rem 0.55rem 0;
}
.proposal .p-table td {
  padding: 0.55rem 0.6rem 0.55rem 0;
  border-top: 1px solid color-mix(in srgb, var(--border) calc(0.55 * 100%), transparent);
  white-space: nowrap;
}
.proposal .p-table td:last-child,
.proposal .p-table th:last-child { text-align: right; padding-right: 0; }
.proposal .p-table tbody tr { position: relative; }
.proposal .p-table tbody tr:hover td { background: hsl(var(--laser-cool) / 0.06); }
.proposal .p-table tbody tr:hover td:first-child {
  box-shadow: inset 1px 0 0 hsl(var(--laser) / 0.55);
}

.proposal .p-feed { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.7rem; }
.proposal .p-feed li { display: flex; gap: 0.65rem; min-width: 0; font-size: 0.8125rem; }
.proposal .p-dot {
  margin-top: 0.4rem;
  width: 0.3rem;
  height: 0.3rem;
  border-radius: 1px;
  background: hsl(var(--laser) / 0.75);
  flex-shrink: 0;
}
.proposal .p-feed time { display: block; color: var(--muted-foreground); font-size: 0.7rem; }

.proposal .p-alert {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.55rem;
  padding: 0.7rem 0.85rem;
  font-size: 0.8125rem;
}
.proposal .p-alert svg { color: hsl(var(--status-warning)); margin-top: 0.1rem; }

.proposal .p-plastic {
  position: relative;
  aspect-ratio: 1.586;
  width: 100%;
  max-width: 22rem;
  border-radius: 0.65rem;
  padding: 1rem;
  overflow: hidden;
  color: hsl(var(--gloss-highlight));
  background:
    linear-gradient(135deg, hsl(var(--gloss-highlight) / 0.18), transparent 42%),
    linear-gradient(165deg, var(--primary), var(--sidebar));
  box-shadow:
    inset 0 1px 0 hsl(var(--gloss-highlight) / 0.28),
    0 10px 28px color-mix(in srgb, var(--foreground) calc(0.28 * 100%), transparent);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.proposal .p-plastic::before {
  content: '';
  pointer-events: none;
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(
    135deg,
    hsl(var(--gloss-highlight) / 0.4),
    hsl(var(--laser-cool) / 0.22) 32%,
    hsl(var(--laser) / 0.2) 72%,
    hsl(var(--gloss-highlight) / 0.1)
  );
  mask: linear-gradient(black 0 0) content-box, linear-gradient(black 0 0);
  mask-composite: exclude;
  -webkit-mask: linear-gradient(black 0 0) content-box, linear-gradient(black 0 0);
  -webkit-mask-composite: xor;
}
.proposal .p-plastic-top,
.proposal .p-plastic-bot { position: relative; display: flex; justify-content: space-between; gap: 0.5rem; }
.proposal .p-plastic-brand {
  margin: 0;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  opacity: 0.8;
}
.proposal .p-chip-card {
  width: 2.75rem;
  height: 2.1rem;
  border-radius: 0.2rem;
  background: linear-gradient(135deg, hsl(var(--status-warning)), color-mix(in srgb, hsl(var(--status-warning)) 70%, var(--foreground)));
  box-shadow: inset 0 1px 0 hsl(var(--gloss-highlight) / 0.4);
}
.proposal .p-pan {
  margin: 0;
  font-size: 0.95rem;
  letter-spacing: 0.18em;
  font-variant-numeric: tabular-nums;
}
.proposal .p-plastic-name { margin: 0.2rem 0 0; font-size: 0.75rem; opacity: 0.85; }

.proposal .p-theme {
  display: inline-flex;
  padding: 2px;
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--border) calc(0.35 * 100%), transparent);
}
.proposal .p-theme button {
  width: 1.7rem;
  height: 1.7rem;
  border: 0;
  border-radius: var(--radius-chip);
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
  display: grid;
  place-items: center;
}
.proposal .p-theme button.is-current {
  background: color-mix(in srgb, var(--card) calc(0.9 * 100%), transparent);
  color: var(--foreground);
  box-shadow: 0 0 0 1px hsl(var(--laser) / 0.28);
}

.proposal .p-avatar {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: var(--radius);
  display: grid;
  place-items: center;
  font-size: 0.65rem;
  font-weight: 700;
  background: var(--primary);
  color: var(--primary-foreground);
  box-shadow: 0 0 0 1px hsl(var(--laser) / 0.28);
}

.proposal .p-menu { display: inline-flex; }
.proposal .p-drawer {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 40;
  background: color-mix(in srgb, var(--foreground) calc(0.45 * 100%), transparent);
}
.proposal .p-drawer.is-open { display: block; }
.proposal .p-drawer-panel {
  width: min(16rem, 86%);
  height: 100%;
  background: var(--sidebar);
  color: var(--sidebar-foreground);
  display: flex;
  flex-direction: column;
}

.proposal .p-formula {
  margin: 0.75rem 0 0;
  padding: 0.65rem 0.75rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.75rem;
  border-radius: var(--radius-chip);
  background: color-mix(in srgb, var(--foreground) calc(0.04 * 100%), transparent);
  color: var(--foreground);
}
.dark .proposal .p-formula { background: hsl(var(--gloss-highlight) / 0.04); }
.proposal .p-formula em { color: hsl(var(--laser-cool)); font-style: normal; }

@media (min-width: 768px) {
  .proposal .p-aside { display: flex; }
  .proposal .p-menu { display: none; }
  .proposal .p-kpis { grid-template-columns: 1fr 1fr 1fr 1fr; }
  .proposal .p-grid { grid-template-columns: 1.3fr 0.7fr; }
  .proposal .p-cards { grid-template-columns: 1fr 1fr; }
}
.proposal .p-cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}
`

export default function DevDirectionPage() {
  const [tab, setTab] = useState<WorkspaceTab>('overview')
  const [menu, setMenu] = useState(false)

  return (
    <div className="proposal">
      <style>{CSS}</style>
      <div className="p-shell">
        <aside className="p-aside" aria-label="Primary">
          <Rail />
        </aside>

        <div className="p-maincol">
          <header className="p-header">
            <div className="p-crumbs">
              <button
                type="button"
                className="p-btn p-btn-outline p-menu"
                aria-label="Open menu"
                onClick={() => setMenu(true)}
              >
                <MenuIcon className="size-4 shrink-0" aria-hidden />
                Menu
              </button>
              <span>Projects</span>
              <span aria-hidden>/</span>
              <b>APAC Q3 field ops</b>
            </div>
            <div className="p-header-actions">
              <ThemeToggle />
              <button
                type="button"
                className="p-btn p-btn-ghost p-btn-icon"
                aria-label="Notifications"
              >
                <BellIcon className="size-4 shrink-0" aria-hidden />
              </button>
              <span className="p-avatar" aria-hidden>
                AM
              </span>
            </div>
          </header>

          <main className="p-page">
            <div className="p-glass p-laser-cap p-banner">
              Proposal only — sharper geometry (4px), optical glass, and a 1px laser tick that fades
              to the caps. Consumes product tokens from <strong>globals.css</strong>.
            </div>

            <div className="p-stack">
              <div className="p-row" style={{ justifyContent: 'space-between' }}>
                <div className="min-w-0">
                  <p className="p-kicker">Northwind · APAC-Q3</p>
                  <div className="p-row">
                    <h1 className="p-title">APAC Q3 field ops</h1>
                    <span className="p-chip p-chip-ok">Active</span>
                  </div>
                </div>
                <div className="p-row">
                  <button type="button" className="p-btn p-btn-outline">
                    Freeze cards
                  </button>
                  <button type="button" className="p-btn p-btn-primary">
                    <PlusIcon className="size-4 shrink-0" aria-hidden />
                    New request
                  </button>
                </div>
              </div>

              <div className="p-glass p-tabs" role="tablist" aria-label="Workspace">
                {TABS.map((item) => {
                  const Icon = item.icon
                  const current = item.id === tab
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={current}
                      className={current ? 'p-tab is-current' : 'p-tab'}
                      onClick={() => setTab(item.id)}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      {item.label}
                    </button>
                  )
                })}
                <span className="p-tab" style={{ pointerEvents: 'none', opacity: 0.45 }}>
                  <UsersIcon className="size-4 shrink-0" aria-hidden />
                  People
                </span>
              </div>

              {tab === 'overview' ? <Overview /> : null}
              {tab === 'budget' ? <Budget /> : null}
              {tab === 'cards' ? <Cards /> : null}
            </div>
          </main>
          <WalkCrowd />
        </div>
      </div>

      <div
        className={menu ? 'p-drawer is-open' : 'p-drawer'}
        hidden={!menu}
        onClick={() => setMenu(false)}
      >
        <div
          className="p-drawer-panel"
          role="dialog"
          aria-label="Menu"
          onClick={(event) => event.stopPropagation()}
        >
          <Rail />
        </div>
      </div>
    </div>
  )
}

function Rail() {
  return (
    <>
      <div className="p-aside-brand">
        <Image
          src={publicAsset.logomark}
          alt=""
          width={1268}
          height={950}
          className="h-7 w-auto shrink-0"
          unoptimized
          priority
        />
        <BrandWordmark className="h-5 shrink-0" />
      </div>
      <button type="button" className="p-org p-laser-cap">
        <span className="p-org-mark">N</span>
        <span className="p-org-copy">
          <strong>Northwind</strong>
          <span>Owner</span>
        </span>
      </button>
      <ul className="p-nav">
        {NAV.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.id}>
              <button type="button" className={item.current ? 'is-current' : undefined}>
                <Icon className="size-4 shrink-0" aria-hidden />
                {item.label}
                {'badge' in item && item.badge ? (
                  <span className="p-nav-badge">{item.badge}</span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function Overview() {
  return (
    <>
      <div className="p-kpis">
        <article className="p-glass p-laser-cap p-kpi">
          <p className="p-kicker">Approved</p>
          <span className="p-num">$50,000.00</span>
          <p className="p-kpi-sub">USD · set 12 Aug</p>
        </article>
        <article className="p-glass p-kpi">
          <p className="p-kicker">Remaining</p>
          <span className="p-num">$9,449.50</span>
          <p className="p-kpi-sub">Unclamped · 81% used</p>
        </article>
        <article className="p-glass p-kpi">
          <p className="p-kicker">Open cards</p>
          <span className="p-num">6</span>
          <p className="p-kpi-sub">2 shared · 4 individual</p>
        </article>
        <article className="p-glass p-kpi">
          <p className="p-kicker">Pending</p>
          <span className="p-num">3</span>
          <p className="p-kpi-sub">$6,412.00 in queue</p>
        </article>
      </div>

      <section className="p-glass p-meter">
        <div className="p-row" style={{ justifyContent: 'space-between' }}>
          <h2 className="p-title" style={{ fontSize: '0.9rem' }}>
            Budget
          </h2>
          <span className="p-chip p-chip-info">Healthy</span>
        </div>
        <div className="p-track" aria-hidden>
          <span className="p-seg-actual" />
          <span className="p-seg-commit" />
        </div>
        <div className="p-legend">
          <span>
            <i className="p-swatch" style={{ background: 'hsl(var(--budget-actual))' }} />
            Actual $22,150.50
          </span>
          <span>
            <i className="p-swatch" style={{ background: 'hsl(var(--status-info))' }} />
            Committed $18,400.00
          </span>
          <span>
            <i className="p-swatch" style={{ background: 'hsl(var(--budget-remaining))' }} />
            Remaining $9,449.50
          </span>
        </div>
      </section>

      <div className="p-alert p-glass">
        <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
        <div>
          <strong>Headcount ingest is 4h stale.</strong> Limits still compute from the last observed
          value; they will move when the next ingest lands.
        </div>
      </div>

      <div className="p-grid">
        <section className="p-glass p-panel">
          <div
            className="p-row"
            style={{ justifyContent: 'space-between', marginBottom: '0.75rem' }}
          >
            <h3 style={{ margin: 0 }}>Pending approvals</h3>
            <div className="p-search" style={{ maxWidth: '12rem' }}>
              <SearchIcon className="size-4 shrink-0" aria-hidden />
              <input className="p-input" placeholder="Filter vendor" aria-label="Filter vendor" />
            </div>
          </div>
          <div className="p-table-wrap">
            <table className="p-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Holder</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Amazon Web Services</td>
                  <td>Priya Shah</td>
                  <td className="p-num">$4,230.00</td>
                </tr>
                <tr>
                  <td>Qantas Business</td>
                  <td>James Okonkwo</td>
                  <td className="p-num">$1,184.50</td>
                </tr>
                <tr>
                  <td>Figma</td>
                  <td>Shared · Design</td>
                  <td className="p-num">$997.50</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="p-glass p-panel">
          <h3>Activity</h3>
          <ul className="p-feed">
            <li>
              <span className="p-dot" aria-hidden />
              <div>
                Rule raised the monthly limit on AWS — Q3 infra
                <time>2 hours ago · Rule</time>
              </div>
            </li>
            <li>
              <span className="p-dot" aria-hidden />
              <div>
                Priya submitted Qantas Business for $1,184.50
                <time>Yesterday · User</time>
              </div>
            </li>
            <li>
              <span className="p-dot" aria-hidden />
              <div>
                Airwallex cleared Stripe · billed as $612.40 USD
                <time>Yesterday · Airwallex</time>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </>
  )
}

function Budget() {
  return (
    <>
      <div className="p-kpis">
        <article className="p-glass p-laser-cap p-kpi">
          <p className="p-kicker">Approved</p>
          <span className="p-num">$50,000.00</span>
        </article>
        <article className="p-glass p-kpi">
          <p className="p-kicker">Committed</p>
          <span className="p-num">$18,400.00</span>
        </article>
        <article className="p-glass p-kpi">
          <p className="p-kicker">Actual</p>
          <span className="p-num">$22,150.50</span>
        </article>
        <article className="p-glass p-kpi">
          <p className="p-kicker">Remaining</p>
          <span className="p-num">$9,449.50</span>
        </article>
      </div>
      <section className="p-glass p-panel p-laser-cap">
        <h3>Limit formula</h3>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
          Derived from approved amount and live headcount. Humans do not type a card limit.
        </p>
        <p className="p-formula">
          min(<em>approved</em> / <em>headcount</em>, 250000) · USD
        </p>
      </section>
    </>
  )
}

function Cards() {
  return (
    <div className="p-cards">
      <article className="p-plastic">
        <div className="p-plastic-top">
          <div>
            <p className="p-plastic-brand">Allocard</p>
            <p className="p-plastic-name">AWS — Q3 infra</p>
          </div>
          <span className="p-chip-card" aria-hidden />
        </div>
        <div className="p-plastic-bot">
          <p className="p-pan">•••• •••• •••• 4242</p>
          <span className="p-chip p-chip-ok">Active</span>
        </div>
      </article>
      <article className="p-plastic">
        <div className="p-plastic-top">
          <div>
            <p className="p-plastic-brand">Allocard</p>
            <p className="p-plastic-name">Field travel · shared</p>
          </div>
          <span className="p-chip-card" aria-hidden />
        </div>
        <div className="p-plastic-bot">
          <p className="p-pan">•••• •••• •••• 8891</p>
          <span className="p-chip p-chip-warn">Frozen</span>
        </div>
      </article>
    </div>
  )
}
