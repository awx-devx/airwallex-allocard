# F0 — Client Foundation

**Track:** Client foundation · **Depends on:** B9 (the whole backend) · **Powers:** F1–F3, all of Track A

## Goal

Everything a screen needs before a screen exists: the shell, the providers, a typed API client, session handling, route guards, and the conventions for loading, empty, and error states. No product screens ship in this phase.

## Deliverables

### Typed API client

Generated off `shared/contracts`, so no endpoint is ever called with a hand-written URL or an untyped body.

```ts
// src/client/api/client.ts
export async function call<C extends Contract>(
  contract: C,
  args: { params?: PathParams<C>; input?: z.infer<C['input']> },
): Promise<z.infer<C['output']>>
```

Responsibilities:

- Build the URL from `contract.path` and typed params
- Serialise input, attach credentials
- **Parse the response against `contract.output`** in development and throw loudly on mismatch. This is what catches backend drift the moment it happens rather than three screens later.
- Convert the error envelope into a typed `ApiError` carrying `code`, `message`, and `details`

### Error handling

`ApiError` maps the B0 error codes to client behaviour:

| Code                                           | Client behaviour                                        |
| ---------------------------------------------- | ------------------------------------------------------- |
| `UNAUTHENTICATED`                              | Redirect to sign-in, preserving the return path         |
| `ONBOARDING_INCOMPLETE`                        | Redirect to `/onboarding`                               |
| `PERMISSION_DENIED`                            | Inline permission message naming the missing permission |
| `NOT_FOUND`                                    | Not-found view                                          |
| `VALIDATION_FAILED`                            | Map `details` onto form fields                          |
| `CONFLICT`                                     | Toast with the server's message; refetch                |
| `RATE_LIMITED` / `UPSTREAM_ERROR` / `INTERNAL` | Retryable error state                                   |

Decide this once, here. Every hook and screen then inherits it.

### Providers

`QueryClientProvider` with the defaults from F1, session provider, toast host, and a top-level error boundary. Configure the QueryClient once, in one file.

### Route groups and guards

```
app/(auth)/          unauthenticated only — redirects in if a session exists
app/(onboarding)/    authenticated, not onboarded
app/(app)/           authenticated and onboarded
```

The guard runs server-side in each group's layout. **A client-side redirect is not a guard** — it's a courtesy that happens after the page has already been sent.

### App shell

Left navigation, org switcher, project context, user menu, and badge counts for pending approvals. Slots only — the screens fill them in Track A.

### State conventions

Four states for every data-driven surface, decided now so screens don't each invent their own: **loading** (skeleton, matching final layout to avoid shift), **empty** (illustration, explanation, primary action), **error** (message plus retry), **partial** (data present but stale or degraded, shown with a subtle indicator rather than hidden).

The partial state matters more here than in a typical app: attribute values carry `observedAt`, and the UI must be able to say "this number is fifteen minutes old" rather than implying it's live.

## Review checklist

- [x] No component calls `fetch` directly; everything goes through the client
- [x] Response validation against contracts is active in development
- [x] Every error code has a defined client behaviour
- [x] Route guards run server-side in layouts
- [x] The shell renders with mocked data in every state
- [x] No server-only import is reachable from client code — the ESLint boundary rule proves it

## Out of scope

Query hooks (F1), UI primitives (F3), any product screen.
