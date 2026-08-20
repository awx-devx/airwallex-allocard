# Layout — don't break at narrow widths

Desktop (`md` and up, 768px) is the product. Narrower widths must still **work and show everything**. They do not have to look good. There is no mobile app, no separate mobile IA, and no extra breakpoints.

**Don't-break means:** the page itself has no horizontal scrollbar, nothing overlaps, text is readable (truncation with a `title` is fine), and every action is reachable. A table that scrolls _inside_ its container is correct. A page that scrolls sideways is not.

Full recipe: copy the four patterns below. Do not invent a fifth.

## One breakpoint

Use **`md` only** (`768px`). Tailwind: no prefix = narrow, `md:` = desktop.

Do not add `sm:`, `lg:`, `xl:`, or `2xl:` layouts. Do not add container queries. Do not set `min-width` on a page or dialog above `100%`.

## Four patterns — copy these

### 1. Shell — A2 owns this

Collapse is done: aside is `hidden md:flex`; a `md:hidden` Menu button opens F3 `Sheet` with the same `SideNav` / `OrgSwitcher`. Do not build a second nav. Do not reopen F0 or F3.

On desktop the aside is an icon rail (`w-16` in layout). Hover, keyboard focus, or an open org menu expands a panel to `w-56` over the page — labels are hidden when collapsed. Do not reflow `main` on hover. Narrow widths still use the Menu `Sheet` (full labels, no icon rail).

Chrome stays put. The root is viewport-locked (`h-dvh overflow-hidden`). The page may scroll inside `main` (`overflow-y-auto`). List screens use `PageFill` (`min-h-full`) so a table/timeline can grow into leftover space and scroll **inside** instead of leaving a short strip and a blank page. If the page is already taller than the viewport, `main` scrolls — do not `overflow-hidden` the page body, or content with no inner scroller gets clipped. Brand + OrgSwitcher stay pinned; if nav items overflow, only the link list scrolls (`overflow-y-auto`, not `overflow-y-scroll`, not F3 `ScrollArea`). `min-h-0` on flex children that **do** scroll internally is the vertical analogue of pattern 2. Do not use `position: sticky` on **shell chrome**. A sticky table header inside the table scroller is fine.

```tsx
<div className="flex h-dvh overflow-hidden">
  {/* desktop — icon rail; hover/focus expands over the page */}
  <aside className="relative hidden w-16 min-h-0 shrink-0 md:flex">
    <div className="group/sidenav absolute inset-y-0 left-0 flex w-16 min-h-0 flex-col overflow-hidden data-[expanded=true]:w-56">
      {/* brand + OrgSwitcher: shrink-0 */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {/* existing SideNav */}
      </div>
    </div>
  </aside>
  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <header className="relative z-1 shrink-0 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur-xl">
      <div className="flex flex-wrap">…</div>
    </header>
    <main className="relative z-1 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain p-4">
      {children}
    </main>
  </div>
</div>

{/* narrow */}
<Button className="md:hidden" aria-label="Open menu" onClick={open}>Menu</Button>
<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent side="left">
    {/* OrgSwitcher shrink-0; same SideNav in min-h-0 flex-1 overflow-y-auto */}
  </SheetContent>
</Sheet>
```

The header is a full-bleed frosted strip (`bg-background/95`, `border-b`, `backdrop-blur-xl`) — not a rounded card island, not a fading laser tick. Breadcrumbs on the left; theme / account on the right. Doodle wallpaper sits `z-0` behind header/main. The desktop aside is a charcoal dock (`bg-sidebar`). `Sheet` already exists in F3. `h-dvh` is a viewport unit, not a second breakpoint.

### 2. `min-w-0` on every flex child that holds content

This is the overflow bug. A flex item defaults to `min-width: auto`, so a table or long string blows the page out. The shell's main column already has `min-w-0`; **repeat it** on any nested `flex` child that contains a table, code, or unbreakable string.

```tsx
<div className="flex min-w-0 flex-1 flex-col">
```

### 3. Tables fill leftover height and scroll inside

Do not turn tables into card lists. Do not wrap `DataTable` in a second `overflow-x-auto` — the panel already scrolls (`overflow-auto`, sticky thead, `min-h-64` floor).

List pages use `PageFill` (`min-h-full`, **not** `flex-1` or `overflow-hidden`). Chrome (`PageHeader`, filters, `SubNav`) is `shrink-0`. The table/timeline/queue is `flex-1 min-h-64` so that when the page is shorter than `main`, the table **grows into the leftover** and scrolls internally. When chrome + min heights exceed the viewport, `main` page-scrolls. Nested chrome (`ProjectWorkspace`, `BudgetChrome`) uses a `flex-1` slot **without** `min-h-0` — `min-h-0` lets the slot shrink under its content and overlap or clip.

```tsx
<PageFill>
  <PageHeader title="Projects" />
  <DataTable … />
</PageFill>
```

Detail and form pages use `PageFlow` (stacked content). Long pages scroll in `main`.

```tsx
<PageFlow>
  <PageHeader title="Request" />
  {/* stacked cards / form */}
</PageFlow>
```

Toolbar buttons `flex-wrap`. Activity / history use `TimelinePanel`: `fill` when it's the page's main block (`flex-1 min-h-64`, leftover + internal scroll); stacked under other content is `min-h-64 max-h-80` with internal scroll — never `flex-1` in that case or it will crush a sibling table.

### 4. Stack, don't hide

| Desktop                     | Narrow                                    |
| --------------------------- | ----------------------------------------- |
| `grid-cols-N`               | `grid-cols-1 md:grid-cols-N`              |
| Side-by-side form + preview | `flex-col md:flex-row`                    |
| Button row                  | `flex flex-wrap gap-2`                    |
| Workspace tabs              | `flex flex-wrap`                          |
| Wizard step rail            | wrap, or a `<select>` of steps below `md` |

**Never `hidden` a control on narrow unless the same control exists in the Sheet or a wrapping menu.** Hidden-with-no-replacement is a break.

## Never

- `min-w-[800px]`, `w-[1200px]`, `whitespace-nowrap` on a page-level row
- `100vw` (includes the scrollbar and overflows)
- A second layout system, a mobile-only page, or hiding columns except via `DataTable` column visibility
- Pretty-at-the-cost-of-clipping: if it doesn't fit, wrap or scroll inside, don't shrink type below readable

## Check before ticking a Track A task

Resize to **375px** and **768px**. Pass if: no page-level horizontal scrollbar, primary actions reachable, no overlapping chrome. Fail if you have to scroll the _window_ sideways to see a button or a number.

Auth screens (A1) have no shell — a centred `max-w-md w-full px-4` column is enough.
