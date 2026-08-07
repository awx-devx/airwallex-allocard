# F3 — UI Library & Kitchen Sink

**Track:** Client foundation · **Depends on:** F2 · **Powers:** all of Track A

## Goal

Every visual element the app will use, built and reviewable on one page before any screen exists. Track A should introduce no new primitives.

## Deliverables

### Design tokens

Colour scales including semantic status colours, spacing, typography, radii, shadows, and z-index layers, as CSS variables with a dark mode mapping. Fix these first — retrofitting tokens after fifty components exist is a rewrite.

### Primitives (`components/ui/`)

shadcn/ui-derived, adjusted to the tokens: Button, Input, Textarea, Select, Combobox, Checkbox, Radio, Switch, DatePicker, DateRangePicker, Label, FormField, Dialog, Sheet, Popover, Tooltip, DropdownMenu, Tabs, Table, Badge, Avatar, Card, Alert, Toast, Skeleton, Progress, Separator, ScrollArea, Command, Breadcrumb, Pagination.

### Patterns (`components/patterns/`)

The composed, app-specific pieces — the ones worth reviewing closely because they encode product meaning:

| Component | Notes |
| --- | --- |
| `DataTable` | Sorting, filters, cursor pagination, row selection, empty and loading states, column visibility |
| `MoneyDisplay` | Amount with currency, optional compact form, colour by sign |
| `BudgetBar` | Approved / committed / actual / remaining as one stacked bar. Used everywhere; get it right once |
| `StatusBadge` | Variant per enum, one component for all of them |
| `AttributeValue` | Value plus `observedAt`, with a staleness indicator |
| `PermissionGate` | Renders children, or an explanatory tooltip when denied |
| `CardVisual` | Card representation with masked number, status, and reveal trigger |
| `LimitMeter` | Remaining versus total limit, per interval |
| `Timeline` | Activity and audit entries, with actor type distinguished |
| `RuleSentence` | A rule rendered as readable prose |
| `DiffView` | Before/after for audit entries and rule runs |
| `EmptyState` | Illustration, explanation, primary action |
| `ErrorState` | Message plus retry, per F0's error taxonomy |
| `ConfirmDialog` | Destructive confirmation; requires typing to confirm for irreversible actions |
| `StepWizard` | Progress, validation per step, dirty guard — powers the A2 project wizard |

`ConfirmDialog`'s type-to-confirm mode is specifically for closing a card, which is irreversible at Airwallex.

### The kitchen sink

`/dev/ui`, available only outside production, rendering **every component in every state**: default, hover, focus, disabled, loading, error, empty, and both themes. Grouped by category with a jump nav.

This page is the review artefact for this phase. Reviewing components inside half-built screens means judging them against incomplete context; reviewing them side by side surfaces inconsistency immediately — three different spinners, four shades of "danger", two date formats.

Include realistic data, not lorem ipsum. A `BudgetBar` with plausible numbers reveals layout problems that `100 / 100 / 100` hides.

### Accessibility baseline

Keyboard navigation throughout, visible focus rings, ARIA labels on icon-only buttons, focus trapping in dialogs, and announced toasts. Cheap now, expensive to retrofit.

## Review checklist

- [ ] `/dev/ui` renders every component in every state, in both themes
- [ ] No hardcoded colours or spacing — tokens only
- [ ] One spinner, one skeleton style, one date format, one empty state pattern
- [ ] `BudgetBar` and `LimitMeter` are correct at the boundaries: zero, full, over-budget
- [ ] `ConfirmDialog` requires typed confirmation for irreversible actions
- [ ] Keyboard-only navigation works across the page
- [ ] Track A can be built without adding a new primitive — walk each A-phase's screens against this list

## Out of scope

Screens (Track A), animation beyond basic transitions, a published component library.
