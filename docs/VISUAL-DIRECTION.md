# Visual direction

How Allocard looks. Components inherit this; Track A does not invent a second palette.

**Supersedes** the original F3.0 “quiet chrome / loud numbers” brief (2026-08-14 user retune: sharper, glossier, tinted).

## Genre

Dense finance / procurement ops UI — sharp and intentional, not a consumer fintech marketing site, not Linear indigo, not purple SaaS, not Airwallex brand.

Chrome may carry **cool ice / steel tints** and a **controlled gloss** (inset highlight + soft elevation). Meaning colour still lives on money, status, and budget segments — do not rainbow the nav.

## Rules

1. **Tokens only.** Surfaces, status, money, shadows, and gloss highlights are CSS variables in `src/app/globals.css`. No raw `#hex` / `rgb()` / bare `hsl()` in `src/components/**`, `src/client/shell/**`, `src/client/states/**`, `src/app/dev/**`.
2. **Sharp geometry.** `--radius` ≈ `0.375rem` for chrome. Prefer crisp borders over soft blobs. `rounded-full` only where badges/avatars already use it. Exception: `CardVisual` uses `rounded-xl` + ID-1 aspect (`1.586`) to read as payment plastic — still token colours only.
3. **Gloss is structural, not decorative noise.** Primary buttons, cards, and elevated panels use `--shadow-gloss-*` / `--shadow-elevated`. Do not add per-screen gradients or glow stacks.
4. **Tints are cool.** Ice-mist backgrounds, steel-cyan accent wash, deep slate-teal primary. Forbidden: indigo/violet primary, neon dark mode, warm stone/cream canvas, Airwallex marketing palette.
5. **Status chroma is medium.** Punchier than the original desaturated steel/forest/ochre/brick, still not Tailwind `*-500` traffic lights. BudgetBar: actual = ink; committed = info; remaining = track; over = danger.
6. **Type:** `system-ui, sans-serif`. No display / serif / Google font.
7. **Dark mode** is class `.dark` on `<html>` — same token names, lifted lightness, same gloss model (highlight softens).

## Where to change

| Change                          | File                                        |
| ------------------------------- | ------------------------------------------- |
| Colours, radius, shadows, gloss | `src/app/globals.css`                       |
| Locked F3 policies + HSL table  | `docs/phases/frontend/F3-TASKS.md` (§ F3.0) |
| Phase summary                   | `docs/phases/frontend/F3-ui-library.md`     |
| Review in browser               | `/dev/ui` (both themes)                     |

Do not fork a second theme in Track A. If a screen needs a new colour, add a named token first.
