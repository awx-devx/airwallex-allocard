# Visual direction

How Allocard looks. Components inherit this; Track A does not invent a second palette.

**Supersedes** the original F3.0 “quiet chrome / loud numbers” brief (2026-08-14 user retune: sharper, glossier, tinted). 2026-08-19: product chrome matches `/dev/direction` — denser cool canvas, optical glass, 1px laser tick.

## Genre

Dense finance / procurement ops UI — sharp and intentional, not a consumer fintech marketing site, not Linear indigo, not purple SaaS, not Airwallex brand.

Chrome is the **frame**, not another card: charcoal sidebar (`--sidebar`, matches the logomark field) and a solid frosted header strip (`bg-background/95`, `border-b`, `backdrop-blur-xl`). Active nav uses a 1px left-edge laser on `--sidebar-primary` (hot mid, fade to the caps, no white core) — that is brand, not a rainbow. Content cards are opaque paper (`bg-card` + border + `--shadow-glass`). Tables sit in a bordered `bg-card` panel. Meaning colour still lives on money, status, and budget segments.

Doodle wallpaper (`DoodleBackdrop`) sits `z-0` under header/main. Auth uses a louder `--laser` tint; the app shell uses a quieter `--muted-foreground` wash. The SVG is a CSS mask so ink follows tokens, never the file’s baked orange.

## Rules

1. **Tokens only.** Surfaces, status, money, shadows, gloss, and laser are CSS variables in `src/app/globals.css`. No raw `#hex` / `rgb()` / bare `hsl()` in `src/components/**`, `src/client/shell/**`, `src/client/states/**`, `src/app/dev/**`. `hsl(var(--…))` is allowed. `/dev/direction` consumes these tokens — no second `--p-*` theme.
2. **Sharp geometry.** `--radius` is `0.25rem` for chrome. Chips use `--radius-chip` (`0.125rem`). Prefer crisp borders over soft blobs. `rounded-full` only for avatars. Exception: `CardVisual` uses `rounded-xl` + ID-1 aspect (`1.586`) to read as payment plastic — still token colours only.
3. **Gloss is structural, not decorative noise.** Cards use opaque `--card` fill, a 1px `--border`, and `--shadow-glass` (inset sheen only — never a pseudo overlay on top of copy). Outline buttons are bordered paper, not glass. Primary buttons use `--shadow-gloss-primary` plus a 1px `--laser` rim. Do not add per-screen gradients or glow stacks. Laser is a **hairline** tick that fades to the caps (`.laser-cap`) on content heroes — not a neon bar, not the header edge.
4. **Tints stay quiet.** Neutral cool-grey canvas (`--background`), paper cards, grey accent wash. Brand orange (`--laser`) is sidenav + primary in dark. Do not paint cyan onto the desk or card rims. Forbidden: indigo/violet primary, neon dark mode, warm stone/cream canvas, Airwallex marketing palette, steel-cyan card wash.
5. **Status chroma is medium.** Punchier than the original desaturated steel/forest/ochre/brick, still not Tailwind `*-500` traffic lights. BudgetBar: actual = ink; committed = info; remaining = track; over = danger.
6. **Type:** UI is `system-ui, sans-serif`. The brand wordmark is **Satoshi Black** (`font-brand`, weight 900) next to `public/brand/logomark.png` — wordmark only, never body copy. No display / serif / Google font. Money is tabular.
7. **Dark mode** is class `.dark` on `<html>` — same token names, lifted lightness, same gloss model (highlight softens). Dark primary is `--laser`.
8. **Icons are Lucide.** `lucide-react` only (`XxxIcon` suffix). Next to a label: `className="size-4 shrink-0"` and `aria-hidden`. EmptyState illustration: `size-8`. Inherit `currentColor` — no per-icon hex/hsl. Icon-only controls still need `aria-label`. Do not rainbow the nav; status colour stays on StatusBadge, money, and Alert variants. No icons on every heading, StatusBadge, MoneyDisplay, or form field. No second icon pack (no Google brand mark). Button `asChild`: the icon goes _inside_ the single child (`Link`), never as a sibling.

## Where to change

| Change                             | File                                              |
| ---------------------------------- | ------------------------------------------------- |
| Colours, radius, shadows, gloss    | `src/app/globals.css`                             |
| Brand lockup (logomark + wordmark) | `src/client/shell/BrandLogo.tsx`, `public/brand/` |
| Locked F3 policies + HSL table     | `docs/phases/frontend/F3-TASKS.md` (§ F3.0)       |
| Phase summary                      | `docs/phases/frontend/F3-ui-library.md`           |
| Review in browser                  | `/dev/ui` and `/dev/direction` (both themes)      |

Do not fork a second theme. If a screen needs a new colour, add a named token first.
