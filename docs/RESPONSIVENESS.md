# Layout — don't break at narrow widths

Desktop (`md` and up, 768px) is the product. Narrower widths must still **work and show everything**. They do not have to look good. There is no mobile app, no separate mobile IA, and no extra breakpoints.

**Don't-break means:** the page itself has no horizontal scrollbar, nothing overlaps, text is readable (truncation with a `title` is fine), and every action is reachable. A table that scrolls _inside_ its container is correct. A page that scrolls sideways is not.

Full recipe: copy the four patterns below. Do not invent a fifth.

## One breakpoint

Use **`md` only** (`768px`). Tailwind: no prefix = narrow, `md:` = desktop.

Do not add `sm:`, `lg:`, `xl:`, or `2xl:` layouts. Do not add container queries. Do not set `min-width` on a page or dialog above `100%`.

## Four patterns — copy these

### 1. Shell — A2 owns this

`AppShell` currently has a always-visible `w-56` sidebar that overflows a phone. Fix it once in A2, when the shell first appears in product screens. Do not reopen F0 or F3.

```tsx
{/* desktop */}
<aside className="hidden w-56 shrink-0 flex-col md:flex">…existing SideNav…</aside>

{/* narrow */}
<Button className="md:hidden" aria-label="Open menu" onClick={open}>Menu</Button>
<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent side="left">{/* same SideNav, OrgSwitcher */}</SheetContent>
</Sheet>
```

The header stays. `Sheet` already exists in F3. Do not build a second nav.

### 2. `min-w-0` on every flex child that holds content

This is the overflow bug. A flex item defaults to `min-width: auto`, so a table or long string blows the page out. The shell's main column already has `min-w-0`; **repeat it** on any nested `flex` child that contains a table, code, or unbreakable string.

```tsx
<div className="flex min-w-0 flex-1 flex-col">
```

### 3. Tables scroll inside, pages do not

Do not turn tables into card lists. Wrap them:

```tsx
<div className="overflow-x-auto">
  <DataTable … />
</div>
```

Prefer adding `overflow-x-auto` once on `DataTable`'s root the first time Track A uses it (A2 project list), so later screens inherit it. Toolbar buttons `flex-wrap`.

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
