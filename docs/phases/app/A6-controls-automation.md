# A6 — Controls & Automation

**Track:** Application · **Powers:** B6 · **Hooks:** `useRules`

## Screens

| Route | Purpose |
| --- | --- |
| `/projects/[id]/controls` | Rules governing this project, plus spending controls |
| `/settings/rules` | Org-wide rules |
| `/settings/rules/[id]` | Rule builder |
| `/settings/rules/[id]/simulate` | What-if simulation |
| `/settings/attributes` | Attribute registry and current values |
| `/automation` | Automation history — every rule run |
| `/cards/[id]/explain` | "Why is this limit what it is?" |

**This is the phase that sells the product.** Everything before it is competent spend management; this is the part nobody else has.

## The rule builder

Trigger picker → condition builder → action list with target selection. Render the rule as prose alongside the form using F2's `RuleSentence`, so the user reads "When remaining budget drops below 10%, freeze member cards" rather than parsing a form.

Show a live match preview: *"With today's values, this rule matches 4 cards and would set the monthly limit to $412."* One call to `POST /api/rules/validate` plus a simulate, and it transforms the builder from abstract to concrete.

Formula fields need syntax highlighting, attribute autocomplete, and inline validation against the server. Never build a second parser in the client.

## Simulation

Override attribute values, run the pipeline, show the resulting per-card diff. Make the overrides obviously temporary and the results obviously hypothetical — a simulation mistaken for reality is worse than no simulation.

This is the most persuasive screen in the demo. Give it room: side-by-side current versus simulated, per-card, with the reasoning visible.

## Automation history

A reverse-chronological feed of rule runs: name, trigger, matched or not, inputs used, diff applied, duration, status. Filterable by rule, card, project, and status. Failed and partial runs need to be prominent, with their conflict explanation readable — a `PARTIAL` run means a rule wanted something impossible, and that's exactly what an admin needs to see.

## The card explainer

For a given card: which rules govern it, what attribute values they consumed, and how the merge produced the final number. This is what turns the engine from a black box into a feature, and it's the answer to the single most likely user question.

## States to handle

- No rules yet — an empty state offering templates from the worked examples
- A rule matching nothing right now
- A rule that has never run
- A failed run, with its error
- A partial run, with its conflict
- Stale attributes feeding a rule — flagged via `AttributeValue`

## Review checklist

- [ ] Rules read as prose, not just as forms
- [ ] The live match preview works and is accurate
- [ ] Simulation is unmistakably hypothetical
- [ ] Simulation output matches what a real run would apply
- [ ] Automation history makes failures and conflicts prominent
- [ ] The card explainer genuinely explains, including the merge
- [ ] No formula or DSL parsing happens client-side
