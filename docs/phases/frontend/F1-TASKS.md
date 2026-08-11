# F1 — Data Layer (TanStack Query) · Tasks

**Spec:** [F1-data-layer.md](./F1-data-layer.md)

**Model:** cheap / LOW — name every file, inline every shape, copy the cited F0 file; do not invent endpoints, change contracts, or build screens/components.

**Depends on:** F0, complete and verified

No new shared contracts: F1 wraps existing `src/shared/contracts/*`. The review gate is the query-key factory + invalidation map + the endpoint→hook inventory below.

---

## F1.0 locked policies (do not reopen)

Approved 2026-08-12. Implementers follow these; do not re-litigate.

1. **Infinite pagination — dual style, no contract migration.**
   - **Cursor** infinite: `activityContracts`, `auditContracts` (`cursor` / `nextCursor`).
   - **Page** infinite: `transactionContracts` list\*, `ruleRunContracts.list` (`page` / `pageSize` / `total`; advance `page += 1` until exhausted).
   - Do **not** change B0–B9 pagination shapes. Spec wording that says “cursor” for all four is superseded by this policy.

2. **No browser hooks** for `webhookContracts.airwallex`, `remoteAuthContracts.decide`, `attributeContracts.ingest`.

3. **Extra endpoint → hook file** (locked):

   | Contract                                   | Hook file            | Hook name(s)                                                                              |
   | ------------------------------------------ | -------------------- | ----------------------------------------------------------------------------------------- |
   | `roleContracts.*`                          | `useMembers.ts`      | `useRoles`, `useCreateRole`, `useUpdateRole`, `useDeleteRole`                             |
   | `accessReviewContracts.*`                  | `useMembers.ts`      | `useAccessReviews`, `useResolveAccessReview`                                              |
   | `cardholderContracts.*`                    | `useCards.ts`        | `useCardholders`, `useCardholder`, `useCreateCardholder`                                  |
   | `approvalRuleContracts.*`                  | `useRequests.ts`     | `useApprovalRules`, `usePutApprovalRules`                                                 |
   | `reportContracts.*`                        | `useReports.ts`      | `useProjectReport`, `useOrganizationReport`, `useFinalReport`                             |
   | `cardContracts.reconcile`                  | `useCards.ts`        | `useReconcileCard`                                                                        |
   | `transactionContracts.syncAdmin`           | `useTransactions.ts` | `useSyncTransactionsAdmin`                                                                |
   | `remoteAuthContracts.simulatePurchase`     | `useRules.ts`        | `useSimulatePurchase` (demo mutation; never cached; keeps money-motion hooks ledger-only) |
   | `projectContracts.changeOwner` / `history` | `useProjects.ts`     | `useChangeProjectOwner`, `useProjectHistory`                                              |
   | `projectMemberContracts.accessHistory`     | `useMembers.ts`      | `useAccessHistory`                                                                        |
   | `authContracts.signUp` / `updateMe`        | `useSession.ts`      | `useSignUp`, `useUpdateMe`                                                                |

4. **Spec aliases → real contracts** (no parallel endpoints):
   - `useUpdateCard` → `cardContracts.update` (may include `desiredControls`); invalidate like the spec’s `useUpdateCardControls`
   - `useCreateRule` / `useUpdateRule` / `useEnableRule` / `useDeleteRule` → all invalidate like `useSaveRule`
   - `useSetBudget` → `budgetContracts.put`
   - `useSetAttributeValue` → `attributeContracts.putValue` only (not ingest)

5. **Also locked:** F1.0 ships the **extra `qk.*` keys** listed in the F1.0 task (org, invites, roles, workstreams, closure, reports, etc.). Ephemeral mutations (validate / simulate / preview / pan-token) appear in `invalidationMap` with `[]`. Liberal `cards()` invalidation stays correct for this product.

---

## Review gate

- [x] **F1.0** — Query keys + invalidation map + endpoint inventory (STOP for review)
  - **Files:**
    - `src/client/queryKeys.ts`
    - `src/client/queryKeys.test.ts`
    - `src/client/hooks/invalidationMap.ts`
    - `src/client/hooks/invalidationMap.test.ts`
  - **Do:**
    1. Implement `qk` exactly as the F1 spec block, with filter types imported from existing schemas (do **not** redeclare filter shapes):
       - `ProjectFilter` = `z.infer<typeof listProjectsQuery>` from `src/shared/schemas/project.ts` — fields: `status?: ProjectStatus`, `ownerId?: string`, `costCentre?: string min 1`, `page` coerce int min 1 default 1, `pageSize` coerce int 1–100 default 20, `sort?:` enum `updatedAt|-updatedAt|name|-name|createdAt|-createdAt|startDate|-startDate|status|-status`
       - `EntryFilter` = `z.infer<typeof listBudgetEntriesQuery>` — `type?: BudgetEntryType`, `from?`/`to?` iso datetime, `page`/`pageSize` as above
       - `CardFilter` = `z.infer<typeof listCardsQuery>` — `projectId?`, `status?: CardStatus`, `purpose?: CardPurpose`, `page`/`pageSize`
       - `RuleFilter` = `z.infer<typeof listRulesQuery>` — `projectId?`, `enabled?:` query `'true'|'false'` → boolean, `page`/`pageSize`
       - `RunFilter` = `z.infer<typeof listRuleRunsQuery>` — `ruleId?`, `cardId?`, `projectId?`, `status?: RuleRunStatus`, `page`/`pageSize`
       - `RequestFilter` = `z.infer<typeof listPurchaseRequestsQuery>` — `page`/`pageSize` only (project id is path param on list)
       - `TxFilter` = `z.infer<typeof listTransactionsQuery>` — `cardId?`, `projectId?`, `status?: TransactionStatus`, `from?`/`to?`, `page`/`pageSize`
       - `AuditFilter` = `z.infer<typeof listAuditQuery>` — `subjectType?` string min 1, `subjectId?`, `actorId?`, `action?` string min 1, `projectId?`, `from?`/`to?`, `cursor?` string min 1, `limit` coerce 1–100 default 20
       - Also add keys the inventory needs that the spec sketch omitted (keep hierarchical):
         - `org: (id: string) => ['organizations', id] as const`
         - `orgMembers: (id: string) => ['organizations', id, 'members'] as const`
         - `invites: () => ['invites'] as const`
         - `invitePreview: (token: string) => ['invites', 'preview', token] as const`
         - `roles: () => ['roles'] as const`
         - `workstreams: (id: string) => ['projects', id, 'workstreams'] as const`
         - `projectHistory: (id: string) => ['projects', id, 'history'] as const`
         - `accessHistory: (id: string) => ['projects', id, 'access-history'] as const`
         - `budgetCategories: (id: string) => ['projects', id, 'budget', 'categories'] as const`
         - `budgetHistory: (id: string) => ['projects', id, 'budget', 'history'] as const`
         - `budgetChangeRequests: (id: string) => ['projects', id, 'budget', 'change-requests'] as const`
         - `cardsForProject: (id: string, f?: …) => ['projects', id, 'cards', f ?? {}] as const`
         - `cardholders: (f?: …) => ['cardholders', f ?? {}] as const`
         - `cardholder: (id: string) => ['cardholders', id] as const`
         - `attributeValues: (f?: …) => ['attributes', 'values', f ?? {}] as const`
         - `ruleRun: (id: string) => ['ruleRuns', id] as const`
         - `request: (id: string) => ['requests', id] as const`
         - `approvalRules: (projectId: string) => ['projects', projectId, 'approval-rules'] as const`
         - `accessReviews: (f?: …) => ['accessReviews', f ?? {}] as const`
         - `transaction: (id: string) => ['transactions', id] as const`
         - `declinedTransactions: (f?: …) => ['transactions', 'declined', f ?? {}] as const`
         - `closurePreflight: (id: string) => ['projects', id, 'closure', 'preflight'] as const`
         - `closureStatus: (id: string) => ['projects', id, 'closure', 'status'] as const`
         - `projectReport: (id: string) => ['reports', 'project', id] as const`
         - `organizationReport: () => ['reports', 'organization'] as const`
         - `finalReport: (id: string) => ['reports', 'final', id] as const`
         - `onboardingStatus: () => ['onboarding', 'status'] as const`
    2. `invalidationMap.ts`: export a const object `invalidationMap` whose keys are mutation hook names and values are arrays of **qk factory calls described as data** (e.g. `{ key: 'projects' }` / `{ key: 'project'; idFrom: 'variables.projectId' }` / `{ key: 'cards' }`). Implement `invalidateFor(queryClient, mutationName, ctx)` that resolves those entries to `queryClient.invalidateQueries({ queryKey })`. Encode the F1 spec table plus the extras:

       | Mutation                                                                                                                | Invalidates                                                                                                                                                                                                                                                           |
       | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
       | `useCreateProject`                                                                                                      | `projects()`                                                                                                                                                                                                                                                          |
       | `useUpdateProject`                                                                                                      | `project(id)`, `projects()`                                                                                                                                                                                                                                           |
       | `useTransitionProject`                                                                                                  | `project(id)`, `projects()`, `activity(id)`                                                                                                                                                                                                                           |
       | `useCreateWorkstream` / `useUpdateWorkstream` / `useDeleteWorkstream`                                                   | `workstreams(id)`, `project(id)`                                                                                                                                                                                                                                      |
       | `useChangeProjectOwner`                                                                                                 | `project(id)`, `projects()`, `activity(id)`                                                                                                                                                                                                                           |
       | `useCreateOrganization`                                                                                                 | `me()` (memberships), then rely on me refetch                                                                                                                                                                                                                         |
       | `useUpdateOrganization`                                                                                                 | `org(id)`, `me()`                                                                                                                                                                                                                                                     |
       | `useUpdateOrgMember` / `useRemoveOrgMember`                                                                             | `orgMembers(id)`, `me()`, `permissions()`                                                                                                                                                                                                                             |
       | `useCreateInvite` / `useRevokeInvite`                                                                                   | `invites()`                                                                                                                                                                                                                                                           |
       | `useAcceptInvite`                                                                                                       | `me()`, `onboardingStatus()`, `invites()`                                                                                                                                                                                                                             |
       | `useAddMember`                                                                                                          | `projectMembers(id)`, `project(id)`, `permissions()`                                                                                                                                                                                                                  |
       | `useUpdateMember` (spec: `useUpdateMemberRole`)                                                                         | `projectMembers(id)`, `permissions()`, `cards()`                                                                                                                                                                                                                      |
       | `useRemoveMember`                                                                                                       | `projectMembers(id)`, `project(id)`, `permissions()`, `cards()`                                                                                                                                                                                                       |
       | `useCreateRole` / `useUpdateRole` / `useDeleteRole`                                                                     | `roles()`, `permissions()`, `projectMembers(*)` via prefix `['projects']` members — prefer invalidate `roles()` + `permissions()` + all `projectMembers` by invalidating queries with key starting `['projects']` only if needed; minimum: `roles()`, `permissions()` |
       | `useResolveAccessReview`                                                                                                | `accessReviews()`, `projectMembers(projectId)`, `permissions()`, `cards()`                                                                                                                                                                                            |
       | `useSetBudget` (`put`)                                                                                                  | `budget(id)`, `project(id)`, `cards()`                                                                                                                                                                                                                                |
       | `useCreateBudgetCategory` / `useUpdateBudgetCategory` / `useDeleteBudgetCategory`                                       | `budgetCategories(id)`, `budget(id)`, `cards()`                                                                                                                                                                                                                       |
       | `useCreateBudgetEntry`                                                                                                  | `budgetEntries(id)`, `budget(id)`, `cards()`                                                                                                                                                                                                                          |
       | `useCreateChangeRequest`                                                                                                | `budgetChangeRequests(id)`                                                                                                                                                                                                                                            |
       | `useDecideChangeRequest`                                                                                                | `budget(projectId)`, `budgetEntries(projectId)`, `budgetChangeRequests(projectId)`, `cards()` — take `projectId` from response `budgetChangeRequestSchema.projectId`                                                                                                  |
       | `useCreateCard`                                                                                                         | `cards()`, `cardsForProject(projectId)`, `project(id)`                                                                                                                                                                                                                |
       | `useUpdateCard` (spec controls row)                                                                                     | `card(id)`, `cardLimits(id)`, `cardExplain(id)`, `cards()`                                                                                                                                                                                                            |
       | `useFreezeCard` / `useUnfreezeCard` / `useCloseCard`                                                                    | `card(id)`, `cards()`                                                                                                                                                                                                                                                 |
       | `useReconcileCard`                                                                                                      | `card(id)`, `cardLimits(id)`, `cards()`                                                                                                                                                                                                                               |
       | `useCreateCardholder`                                                                                                   | `cardholders()`                                                                                                                                                                                                                                                       |
       | `useCreateRule` / `useUpdateRule` / `useDeleteRule` / `useEnableRule` (spec `useSaveRule`)                              | `rules()`, `cards()`, and all explain via prefix `['cards']` (liberal cards invalidation is correct)                                                                                                                                                                  |
       | `useSetAttributeValue`                                                                                                  | `attributeValues()`, `attributes()`, `cards()`, `ruleRuns()`                                                                                                                                                                                                          |
       | `useCreateAttribute` / `useUpdateAttribute`                                                                             | `attributes()`                                                                                                                                                                                                                                                        |
       | `useCreateRequest` / `useUpdateRequest` / `useSubmitRequest` / `useCancelRequest`                                       | `requests()` filter lists + `request(id)` + `approvals()` + `approvalCount()` as applicable                                                                                                                                                                           |
       | `useDecideRequest`                                                                                                      | `requests()`, `approvals()`, `approvalCount()`, `budget(projectId)`, `cards()` — `projectId` from `purchaseRequestSchema.projectId`                                                                                                                                   |
       | `usePutApprovalRules`                                                                                                   | `approvalRules(projectId)`                                                                                                                                                                                                                                            |
       | `useUploadReceipt` / `useDeleteReceipt`                                                                                 | `transactions()`, `transaction(id)`                                                                                                                                                                                                                                   |
       | `useSyncTransactionsAdmin`                                                                                              | `transactions()`                                                                                                                                                                                                                                                      |
       | `useSimulatePurchase`                                                                                                   | `transactions()`, `cards()`, `budget(*)` liberal: `transactions()` + `cards()`                                                                                                                                                                                        |
       | `useStartClosure` / `useCompleteClosure`                                                                                | `closureStatus(id)`, `closurePreflight(id)`, `project(id)`, `projects()`, `cards()`, `finalReport(id)`                                                                                                                                                                |
       | `useUpdateMe` / `useSignUp`                                                                                             | `me()`, `onboardingStatus()` as applicable                                                                                                                                                                                                                            |
       | `useSimulateRules` / `useValidateRule` / `useValidateFormula` / `usePreviewMember` / `usePolicyPreview` / `usePanToken` | **nothing** (pure / ephemeral — no cache writes)                                                                                                                                                                                                                      |

    3. Tests: every `qk.*` returns a readonly tuple; hierarchical prefix — `qk.budget(id)` starts with `qk.project(id)`; invalidation map covers every mutation hook name listed in the inventory (F1.4–F1.13). Missing map entry fails the test.
  - **Pattern:** F1 spec “Query key factory” + “Invalidation map”; filter field sources = the schema files cited above. Copy style of pure factories from `src/client/providers/queryClient.ts` (no React).
  - **STOP and get this reviewed before implementing hooks.**
  - **Accept:** `pnpm test client/queryKeys` and `pnpm test client/hooks/invalidationMap`
  - **Notes:** Filter types from `src/shared/types/*`. `invalidateFor` resolves `idFrom` via variables/data; skips when id missing. Ephemeral mutations mapped to `[]`. Continued past review gate per user request to complete all F1 tasks before phase exit.

---

## Implementation tasks

### F1.1 — useCall + CSV download helper

- [x] **F1.1** — `useCall` + export download (not JSON `call`)
  - **Files:**
    - `src/client/hooks/useCall.ts`
    - `src/client/hooks/useCall.test.ts`
    - `src/client/api/download.ts`
    - `src/client/api/download.test.ts`
    - re-export from `src/client/api/index.ts` if useful
  - **Do:**
    1. `useCall()`: return a stable function `(contract, args?) => call(contract, { ...args, orgId: args?.orgId ?? getActiveOrgId() ?? undefined })`. Prefer reading org from `useActiveOrg()` so React re-renders pick up switches; still fall back to `getActiveOrgId()` from `src/client/providers/activeOrg.ts`.
    2. Do **not** change `call()` itself.
    3. `downloadExport(kind, input)` where `kind` is `'budget' | 'transactions' | 'cards' | 'audit'`:
       - Map to `exportContracts.budget|transactions|cards|audit`
       - `input`: `{ projectId?: string /* idSchema */, from?: iso datetime, to?: iso datetime }` = `exportInput`
       - Contract `output` is `z.void()` and the handler streams `text/csv` — **do not use `call()`** (it JSON-parses). Implement with `fetch` + `credentials: 'include'` + `x-org-id` + `Content-Type: application/json` body, then create a Blob and trigger a browser download (filename from `Content-Disposition` or fallback `export-{kind}.csv`).
       - On non-OK: `throw ApiError.fromResponse` like `call()`.
    4. Unit-test `useCall` org injection by mocking `call` and `getActiveOrgId` / wrapping ActiveOrg if needed. Prefer testing a thin `withOrgId(args)` helper if React render is painful — do **not** add `@testing-library/react` unless a hook test truly cannot avoid it; prefer QueryClient + plain `queryFn` tests in later tasks.
  - **Pattern:** `src/client/api/client.ts` (`call`, `CallArgs`) + `src/client/providers/activeOrg.ts` (`getActiveOrgId`) + `src/shared/contracts/export.ts`
  - **Accept:** `pnpm test client/hooks/useCall` and `pnpm test client/api/download`
  - **Notes:** Implemented; `pnpm verify` green.

### F1.2 — Hook conventions helper (copy template for all domains)

- [x] **F1.2** — Shared hook helpers + first-domain pattern doc in code
  - **Files:**
    - `src/client/hooks/queryDefaults.ts`
    - `src/client/hooks/queryDefaults.test.ts`
    - `src/client/hooks/_exampleQueryFn.test.ts` (optional smoke: QueryClient.fetchQuery with mocked `call`)
  - **Do:** Export named overrides used by later hooks (numbers from F1 spec):
    - `defaultQueryOptions` — already on `createAppQueryClient` in `src/client/providers/queryClient.ts` (`staleTime: 30_000`, `gcTime: 5 * 60_000`, retry 5xx ApiError only, `refetchOnWindowFocus: true`). Do not duplicate the client; only export **per-hook** overrides:
      - `cardLimitsQueryOptions`: `{ staleTime: 15_000 }`
      - `approvalCountQueryOptions`: `{ staleTime: 30_000, refetchInterval: 30_000 }`
      - `ruleRunsInFlightQueryOptions`: `{ staleTime: 10_000, refetchInterval: 10_000 }` — caller enables interval only when a run status is in-flight
      - `attributeValuesQueryOptions`: `{ staleTime: 5_000 }`
    - Document in a 5-line comment at top of `queryDefaults.ts`: every hook uses `useCall()` / `call` + `qk.*`; mutations call `invalidateFor(qc, 'useX', ctx)` on settle; types are only `z.infer` from contracts — no manual response interfaces.
  - **Pattern:** `src/client/providers/queryClient.ts` + F1 “Query defaults” / “Special cases”
  - **Accept:** `pnpm test client/hooks/queryDefaults`
  - **Notes:** Implemented; `pnpm verify` green.

### F1.3 — useSession

- [x] **F1.3** — `useSession.ts` (template for all later domain files)
  - **Files:** `src/client/hooks/useSession.ts`, `src/client/hooks/useSession.test.ts`
  - **Do:** One hook per contract below. Types = contract input/output only.
    | Hook                  | Kind     | Contract                         | Path / I/O                                                                                                                                                                                                                                                            |
    | --------------------- | -------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `useMe`               | query    | `authContracts.me`               | `GET /api/me`, input void, output `meResponseSchema`: `{ user: { id, email, name, image?, defaultOrgId?, createdAt }, memberships: [{ id, orgId, userId, orgRole, status, joinedAt, org: { id, name, slug } }], activeOrg?: organizationSchema, onboarded: boolean }` |
    | `usePermissions`      | query    | `mePermissionsContracts.get`     | `GET /api/me/permissions`, void → `{ projects: [{ projectId, permissions: Permission[], scope }] }`                                                                                                                                                                   |
    | `useOnboardingStatus` | query    | `authContracts.onboardingStatus` | `GET /api/onboarding/status`, void → `{ onboarded: boolean, pendingInvites: [{ orgName, invitedByName, orgRole, expiresAt }] }`                                                                                                                                       |
    | `useUpdateMe`         | mutation | `authContracts.updateMe`         | `PATCH /api/me`, input `{ name?: string 1–120, image?: string\|null, defaultOrgId?: string\|null }` (≥1 field) → `meResponseSchema`; invalidate `useUpdateMe`                                                                                                         |
    | `useSignUp`           | mutation | `authContracts.signUp`           | `POST /api/auth/sign-up`, `{ email, password: string 8–128, name: string 1–120 }` → `userSchema`                                                                                                                                                                      |
    - Keys: `qk.me()`, `qk.permissions()`, `qk.onboardingStatus()`.
    - After successful `useMe`, if `activeOrg?.id` and no stored org, call `initActiveOrgId(activeOrg.id)` (F0.9).
  - **Pattern:** Copy structure from this task into F1.4+; wire via `useQuery`/`useMutation` + `useCall` + `qk` + `invalidateFor`. Tests: mock `call`, run `queryClient.fetchQuery` / `mutateAsync` with the same `queryFn`/`mutationFn` the hooks use (export the option factories if needed).
  - **Accept:** `pnpm test client/hooks/useSession`
  - **Notes:** Implemented; `pnpm verify` green.

### F1.4 — useOrganizations

- [x] **F1.4** — `useOrganizations.ts` (orgs + invites)
  - **Files:** `src/client/hooks/useOrganizations.ts`, `src/client/hooks/useOrganizations.test.ts`
  - **Do:**
    | Hook                      | Contract                    | Method path                          | Input → Output                                                                                                                                                                                                                                       |
    | ------------------------- | --------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `useOrganization(id)`     | `organizationContracts.get` | `GET /api/organizations/:id`         | void → `organizationSchema`: `{ id, name, slug, country: len 2, baseCurrency: len 3, costCentres: string[], settings: { defaultApprovalPolicy: string\|null, notifications: Record<string,boolean> }, airwallexAccountId: string\|null, createdAt }` |
    | `useCreateOrganization`   | `.create`                   | `POST /api/organizations`            | `{ name: 1–120, slug?: slug regex, country: len 2, baseCurrency: len 3, costCentres?: string[] default [] }` → org                                                                                                                                   |
    | `useUpdateOrganization`   | `.update`                   | `PATCH /api/organizations/:id`       | partial `{ name?, country?, baseCurrency?, costCentres?, settings? }` ≥1 field → org                                                                                                                                                                 |
    | `useOrgMembers(id)`       | `.listMembers`              | `GET /api/organizations/:id/members` | void → `membershipWithUserSchema[]`: membership + `user: { id, email, name, image? }`                                                                                                                                                                |
    | `useUpdateOrgMember`      | `.updateMember`             | `PATCH .../members/:userId`          | `{ orgRole?: OrgRole, status?: MembershipStatus }` ≥1 → membershipWithUser                                                                                                                                                                           |
    | `useRemoveOrgMember`      | `.removeMember`             | `DELETE .../members/:userId`         | void → void                                                                                                                                                                                                                                          |
    | `useInvites`              | `inviteContracts.list`      | `GET /api/invites`                   | void → `inviteSchema[]`: `{ id, orgId, email, orgRole, expiresAt, status, invitedBy }` (never token)                                                                                                                                                 |
    | `useCreateInvite`         | `.create`                   | `POST /api/invites`                  | `{ email, orgRole }` → invite + `token: string` (create only)                                                                                                                                                                                        |
    | `useRevokeInvite`         | `.revoke`                   | `DELETE /api/invites/:id`            | void → void                                                                                                                                                                                                                                          |
    | `useInvitePreview(token)` | `.preview`                  | `GET /api/invites/preview/:token`    | void → `{ orgName, invitedByName, orgRole, expiresAt }`                                                                                                                                                                                              |
    | `useAcceptInvite`         | `.accept`                   | `POST /api/invites/accept`           | `{ token: string min 1 }` → `membershipSchema`                                                                                                                                                                                                       |
    - Invalidate per F1.0 map. Keys: `qk.org`, `orgMembers`, `invites`, `invitePreview`.
  - **Pattern:** `src/client/hooks/useSession.ts` (F1.3) + contracts `src/shared/contracts/organization.ts`, `invite.ts`
  - **Accept:** `pnpm test client/hooks/useOrganizations`
  - **Notes:** Implemented; `pnpm verify` green.

### F1.5 — useProjects

- [x] **F1.5** — `useProjects.ts`
  - **Files:** `src/client/hooks/useProjects.ts`, `src/client/hooks/useProjects.test.ts`
  - **Do:**
    | Hook                    | Contract                | Notes                                                                                                                                                                              |
    | ----------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `useProjects(filter?)`  | `projectContracts.list` | `GET /api/projects`, input `listProjectsQuery`, output `{ items: project[], page, pageSize, total }`                                                                               |
    | `useProject(id)`        | `.get`                  | `GET /api/projects/:id` → `projectDetailSchema` (project + `overview`)                                                                                                             |
    | `useCreateProject`      | `.create`               | `POST /api/projects`, `createProjectInput`: `{ name: 1–120, code, description?: max 2000, ownerId?, costCentre?, startDate?, endDate?, cardStructure? partial }` → `projectSchema` |
    | `useUpdateProject`      | `.update`               | `PATCH /api/projects/:id`, `updateProjectInput` partial editable fields                                                                                                            |
    | `useTransitionProject`  | `.transition`           | `POST /api/projects/:id/transition`, `{ to: ProjectStatus, reason?: max 500 }`                                                                                                     |
    | `useWorkstreams(id)`    | `.listWorkstreams`      | `GET .../workstreams` → `workstreamSchema[]`                                                                                                                                       |
    | `useCreateWorkstream`   | `.createWorkstream`     | `POST`, `{ name }`                                                                                                                                                                 |
    | `useUpdateWorkstream`   | `.updateWorkstream`     | `PATCH .../workstreams/:wsId`, `{ name }`                                                                                                                                          |
    | `useDeleteWorkstream`   | `.deleteWorkstream`     | `DELETE` → void                                                                                                                                                                    |
    | `useChangeProjectOwner` | `.changeOwner`          | `PATCH .../owner`, `{ ownerId }`                                                                                                                                                   |
    | `useProjectHistory(id)` | `.history`              | `GET .../history` → `{ id, action, actorType, actorId, subjectType, subjectId, before?, after?, metadata, at }[]`                                                                  |
    - Keys: `qk.projects(f)`, `project(id)`, `workstreams(id)`, `projectHistory(id)`.
  - **Pattern:** `src/client/hooks/useSession.ts` + `src/shared/contracts/project.ts`
  - **Accept:** `pnpm test client/hooks/useProjects`
  - **Notes:** Implemented; `pnpm verify` green.

### F1.6 — useMembers

- [x] **F1.6** — `useMembers.ts` (project members, roles, access reviews)
  - **Files:** `src/client/hooks/useMembers.ts`, `src/client/hooks/useMembers.test.ts`
  - **Do:**
    | Hook                        | Contract                      | I/O                                                                                                                                                       |
    | --------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `useProjectMembers(id)`     | `projectMemberContracts.list` | `GET /api/projects/:id/members` → `projectMemberDetailSchema[]` (member + `role` summary + `user` summary; `effectivePermissions: Permission[]`, `scope`) |
    | `useAddMember`              | `.add`                        | `POST`, `{ userId, roleId, scope }` → detail                                                                                                              |
    | `useUpdateMember`           | `.update`                     | `PATCH .../members/:userId`, `{ roleId?, scope? }` ≥1 → detail                                                                                            |
    | `useRemoveMember`           | `.remove`                     | `DELETE` → void                                                                                                                                           |
    | `usePreviewMember`          | `.preview`                    | `POST .../members/preview`, `{ roleId, scope }` → preview output (permission reasons); **no invalidation**                                                |
    | `useAccessHistory(id)`      | `.accessHistory`              | `GET .../access-history` → access history entries                                                                                                         |
    | `useRoles`                  | `roleContracts.list`          | `GET /api/roles` → `roleSchema[]`: `{ id, orgId, key, name, isTemplate, permissions, defaultScope?, createdAt, updatedAt }`                               |
    | `useCreateRole`             | `.create`                     | `POST`, `{ name: 1–120, key?, permissions: Permission[] min 1, defaultScope? }`                                                                           |
    | `useUpdateRole`             | `.update`                     | `PATCH /api/roles/:id`, partial + optional `force?: boolean`                                                                                              |
    | `useDeleteRole`             | `.delete`                     | `DELETE` → void                                                                                                                                           |
    | `useAccessReviews(filter?)` | `accessReviewContracts.list`  | `GET /api/access-reviews`, `{ status?: AccessReviewStatus, projectId? }` → `accessReviewSchema[]`                                                         |
    | `useResolveAccessReview`    | `.resolve`                    | `POST /api/access-reviews/:id/resolve`, `{ resolution: AccessReviewResolution, note?: max 500 }`                                                          |
    - Keys: `qk.projectMembers`, `accessHistory`, `roles`, `accessReviews`.
  - **Pattern:** `src/client/hooks/useProjects.ts` + `src/shared/contracts/projectMember.ts`, `role.ts`, `accessReview.ts`
  - **Accept:** `pnpm test client/hooks/useMembers`
  - **Notes:** Implemented; `pnpm verify` green.

### F1.7 — useBudget

- [x] **F1.7** — `useBudget.ts`
  - **Files:** `src/client/hooks/useBudget.ts`, `src/client/hooks/useBudget.test.ts`
  - **Do:**
    | Hook                                   | Contract               | I/O                                                                                                                                                                                        |
    | -------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
    | `useBudget(projectId)`                 | `budgetContracts.get`  | `GET /api/projects/:id/budget` → `budgetDetailSchema`                                                                                                                                      |
    | `useSetBudget`                         | `.put`                 | `PUT`, `{ currency: len 3, approvedAmount: int ≥0, formula?: string\|null, thresholdPcts?: int 1–1000[] }`                                                                                 |
    | `useBudgetCategories(projectId)`       | `.listCategories`      | `GET .../categories` → category[]                                                                                                                                                          |
    | `useCreateBudgetCategory`              | `.createCategory`      | `POST`, `{ name: 1–120, workstreamId?: string\|null, allocated: int ≥0, formula?: string\|null }`                                                                                          |
    | `useUpdateBudgetCategory`              | `.updateCategory`      | `PATCH .../categories/:catId`, partial ≥1 field                                                                                                                                            |
    | `useDeleteBudgetCategory`              | `.deleteCategory`      | `DELETE` → void                                                                                                                                                                            |
    | `useBudgetEntries(projectId, filter?)` | `.listEntries`         | `GET .../entries`, `listBudgetEntriesQuery` → `{ items, page, pageSize, total }`                                                                                                           |
    | `useCreateBudgetEntry`                 | `.createEntry`         | `POST`, `createBudgetEntryInput` (amount int minor units, type enum, etc. — use schema as source of truth)                                                                                 |
    | `useBudgetHistory(projectId)`          | `.history`             | `GET .../history` → history entries                                                                                                                                                        |
    | `useBudgetChangeRequests(projectId)`   | `.listChangeRequests`  | `GET .../change-requests`                                                                                                                                                                  |
    | `useCreateChangeRequest`               | `.createChangeRequest` | `POST`, `{ deltaAmount: nonzero int, reason: 1–2000 }`                                                                                                                                     |
    | `useDecideChangeRequest`               | `.decideChangeRequest` | `POST /api/budget/change-requests/:id/decide`, `{ decision: 'APPROVE'\|'REJECT', note?: string\|null }` — invalidate using **response.projectId**                                          |
    | `useValidateFormula`                   | `.validateFormula`     | `POST /api/budget/formula/validate`, `{ expression: max 500, context?: Record<string, int> }` → `{ ok: true, value: int } \| { ok: false, error: string }`; **no cache / no invalidation** |
    - Money: integer minor units only — never float.
  - **Pattern:** `src/client/hooks/useProjects.ts` + `src/shared/contracts/budget.ts`
  - **Accept:** `pnpm test client/hooks/useBudget`
  - **Notes:** Implemented; `pnpm verify` green.

### F1.8 — useCards

- [x] **F1.8** — `useCards.ts` (cards + cardholders + optimistic freeze)
  - **Files:** `src/client/hooks/useCards.ts`, `src/client/hooks/useCards.test.ts`
  - **Do:**
    | Hook                                  | Contract                   | Notes                                                                                                                                                         |
    | ------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `useCards(filter?)`                   | `cardContracts.list`       | `listCardsQuery` → `cardListSchema`                                                                                                                           |
    | `useProjectCards(projectId, filter?)` | `.listForProject`          | path project id; `listProjectCardsQuery`                                                                                                                      |
    | `useCard(id)`                         | `.get`                     | → `cardSchema`                                                                                                                                                |
    | `useCreateCard`                       | `.create`                  | `POST /api/projects/:id/cards`, `{ purpose: CardPurpose, cardholderId, nickName?: 1–100, categoryId?: string\|null, accessList?: string[], desiredControls }` |
    | `useUpdateCard`                       | `.update`                  | `PATCH /api/cards/:id`, `{ nickName?, accessList?, desiredControls? }` ≥1; invalidate as controls row                                                         |
    | `useFreezeCard`                       | `.freeze`                  | `POST .../freeze`, void → card; **optimistic** set status frozen in `card(id)` + list caches; rollback on error                                               |
    | `useUnfreezeCard`                     | `.unfreeze`                | same optimistic pattern                                                                                                                                       |
    | `useCloseCard`                        | `.close`                   | `{ confirm: true }` — **not** optimistic                                                                                                                      |
    | `useCardLimits(id)`                   | `.limits`                  | → `{ currency: len 3, limits: [{ interval, amount: int ≥0, remaining: int }], cachedAt }`; apply `cardLimitsQueryOptions` (staleTime 15s)                     |
    | `usePanToken`                         | `.panToken`                | `POST .../pan-token` → `{ token: string min 1, expiresAt }` — mutation, never cache; **never** log token; never touch PAN/CVV/expiry                          |
    | `useReconcileCard`                    | `.reconcile`               | `POST .../reconcile` → card                                                                                                                                   |
    | `useCardholders(filter?)`             | `cardholderContracts.list` | `{ page, pageSize }` → list envelope                                                                                                                          |
    | `useCardholder(id)`                   | `.get`                     | → `{ id, orgId, userId: string\|null, airwallexCardholderId, type, status, createdAt, updatedAt }`                                                            |
    | `useCreateCardholder`                 | `.create`                  | `{ type: CardholderType, userId? }` — INDIVIDUAL requires userId                                                                                              |
    - Optimistic updates **only** for freeze/unfreeze (and receipt in F1.11). Everything else waits for server.
  - **Pattern:** `src/client/hooks/useSession.ts` + `src/shared/contracts/card.ts`, `cardholder.ts`; optimistic: TanStack `onMutate` / `onError` / `onSettled` docs pattern — keep rollback explicit in tests
  - **Accept:** `pnpm test client/hooks/useCards` — assert freeze rollback on `ApiError`
  - **Notes:** Implemented; `pnpm verify` green.

### F1.9 — useRules

- [x] **F1.9** — `useRules.ts` (attributes, rules, simulate, runs, explain)
  - **Files:** `src/client/hooks/useRules.ts`, `src/client/hooks/useRules.test.ts`
  - **Do:**
    | Hook                          | Contract                               | Notes                                                                                                                                                                                        |
    | ----------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `useAttributes(filter?)`      | `attributeContracts.list`              | `listAttributesQuery`: `scope?`, `source?`, `page`/`pageSize`                                                                                                                                |
    | `useCreateAttribute`          | `.create`                              | create definition input from schema                                                                                                                                                          |
    | `useUpdateAttribute`          | `.update`                              | `PATCH /api/attributes/:key`                                                                                                                                                                 |
    | `useAttributeValues(filter?)` | `.listValues`                          | `listAttributeValuesQuery`: `key?`, `subjectType?`, `subjectId?`, `page`/`pageSize`; apply `attributeValuesQueryOptions` (staleTime 5s)                                                      |
    | `useSetAttributeValue`        | `.putValue`                            | `PUT /api/attributes/values`, `{ key, subjectType, subjectId, value, observedAt?, ttlSec?: int\|null }`                                                                                      |
    | `useRules(filter?)`           | `ruleContracts.list`                   | `listRulesQuery`                                                                                                                                                                             |
    | `useCreateRule`               | `.create`                              | → rule; invalidate as `useSaveRule`                                                                                                                                                          |
    | `useUpdateRule`               | `.update`                              | same                                                                                                                                                                                         |
    | `useDeleteRule`               | `.delete`                              | void                                                                                                                                                                                         |
    | `useEnableRule`               | `.enable`                              | enable input from schema                                                                                                                                                                     |
    | `useValidateRule`             | `.validate`                            | mutation, **no invalidation**                                                                                                                                                                |
    | `useSimulateRules`            | `.simulate`                            | **mutation not query**; input `{ ruleIds?: id[] min 1, projectId?, draftRule?, attributeOverrides? }` (≥1 of those); output `{ runs, cardDiffs, conflicts }`; **never** write to query cache |
    | `useSimulatePurchase`         | `remoteAuthContracts.simulatePurchase` | demo mutation; never cache; invalidate `transactions()` + `cards()` (F1.0 locked policy #3)                                                                                                  |
    | `useRuleRuns(filter?)`        | `ruleRunContracts.list`                | infinite page-based (F1.0 locked #1); when any item in-flight, optional `refetchInterval: 10_000`                                                                                            |
    | `useRuleRun(id)`              | `.get`                                 | → `ruleRunSchema`                                                                                                                                                                            |
    | `useCardExplain(id)`          | `cardExplainContracts.explain`         | `GET /api/cards/:id/explain` → `cardExplainSchema`                                                                                                                                           |
    - Do **not** hook `attributeContracts.ingest` or `remoteAuthContracts.decide`.
  - **Pattern:** `src/client/hooks/useCards.ts` + `src/shared/contracts/rule.ts`, `ruleRun.ts`, `attribute.ts`, `remoteAuth.ts`
  - **Accept:** `pnpm test client/hooks/useRules` — simulate hooks do not `setQueryData` for runs/transactions
  - **Notes:** Implemented; `pnpm verify` green.

### F1.10 — useRequests

- [x] **F1.10** — `useRequests.ts` (requests, policy, approvals, approval rules)
  - **Files:** `src/client/hooks/useRequests.ts`, `src/client/hooks/useRequests.test.ts`
  - **Do:**
    | Hook                              | Contract                                 | Notes                                                                                                                                                                    |
    | --------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
    | `usePolicyPreview`                | `purchaseRequestContracts.policyPreview` | `POST /api/policy/preview`, `{ projectId, amount: int ≥0, currency: len 3, categoryId? }` → `{ outcome, reasons: string[], requiredApprovals: int ≥0 }`; no invalidation |
    | `useRequests(projectId, filter?)` | `.list`                                  | `GET /api/projects/:id/requests`, `{ page, pageSize }` → list envelope of `purchaseRequestSchema` (amounts int minor units)                                              |
    | `useRequest(id)`                  | `.get`                                   | `GET /api/requests/:id`                                                                                                                                                  |
    | `useCreateRequest`                | `.create`                                | `POST`, `{ amount: int ≥0, currency: len 3, vendor: 1–200, description: 1–2000, justification: 1–2000, categoryId?: string\|null }`                                      |
    | `useUpdateRequest`                | `.update`                                | `PATCH /api/requests/:id`, partial draft fields                                                                                                                          |
    | `useSubmitRequest`                | `.submit`                                | `POST .../submit`                                                                                                                                                        |
    | `useCancelRequest`                | `.cancel`                                | `POST .../cancel`                                                                                                                                                        |
    | `useDecideRequest`                | `.decide`                                | `POST .../decide`, `{ decision: ApprovalDecision, reason?: 1–2000 }` (reason required on REJECT); invalidate using response `projectId`                                  |
    | `useApprovals(filter?)`           | `.listApprovals`                         | `GET /api/approvals`, same page query                                                                                                                                    |
    | `useApprovalCount`                | `.approvalsCount`                        | `GET /api/approvals/count` → `{ count: int ≥0 }`; apply `approvalCountQueryOptions` (poll 30s)                                                                           |
    | `useApprovalRules(projectId)`     | `approvalRuleContracts.list`             | `GET /api/projects/:id/approval-rules`                                                                                                                                   |
    | `usePutApprovalRules`             | `.put`                                   | `PUT`, body = approval rule array schema                                                                                                                                 |
  - **Pattern:** `src/client/hooks/useBudget.ts` + `src/shared/contracts/purchaseRequest.ts`, `approvalRule.ts`
  - **Accept:** `pnpm test client/hooks/useRequests`
  - **Notes:** Implemented; `pnpm verify` green.

### F1.11 — useTransactions

- [x] **F1.11** — `useTransactions.ts` (lists, receipts optimistic; ledger-only — no demo purchase)
  - **Files:** `src/client/hooks/useTransactions.ts`, `src/client/hooks/useTransactions.test.ts`
  - **Do:**
    | Hook                                         | Contract                    | Notes                                                                                                                                                                                                                                      |
    | -------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
    | `useTransactions(filter?)`                   | `transactionContracts.list` | infinite page-based (F1.0 locked #1)                                                                                                                                                                                                       |
    | `useProjectTransactions(projectId, filter?)` | `.listForProject`           | infinite page-based                                                                                                                                                                                                                        |
    | `useCardTransactions(cardId, filter?)`       | `.listForCard`              | infinite page-based                                                                                                                                                                                                                        |
    | `useTransaction(id)`                         | `.get`                      | → `transactionDetailSchema`                                                                                                                                                                                                                |
    | `useDeclinedTransactions(filter?)`           | `.listDeclined`             | infinite; key `qk.declinedTransactions`                                                                                                                                                                                                    |
    | `useUploadReceipt`                           | `.uploadReceipt`            | `POST .../receipt`, `{ fileName: 1–255, contentType: 'application/pdf'\|'image/jpeg'\|'image/png'\|'image/webp', contentBase64: string min 1 }`; **optimistic** attach flag/receipt meta on `transaction(id)` if cached; rollback on error |
    | `useDeleteReceipt`                           | `.deleteReceipt`            | `DELETE` → void; may optimistic-clear receipt; rollback on error                                                                                                                                                                           |
    | `useSyncTransactionsAdmin`                   | `.syncAdmin`                | `POST /api/admin/sync-transactions` → void                                                                                                                                                                                                 |
    - `useSimulatePurchase` lives in **`useRules.ts`** (F1.9), not here.
    - Only freeze/unfreeze (F1.8) and receipt attach/delete are optimistic in F1.
  - **Pattern:** `src/client/hooks/useCards.ts` (optimistic) + `src/shared/contracts/transaction.ts`
  - **Accept:** `pnpm test client/hooks/useTransactions`
  - **Notes:** Implemented; `pnpm verify` green.

### F1.12 — useReports

- [x] **F1.12** — `useReports.ts` (activity, audit, reports, closure, exports)
  - **Files:** `src/client/hooks/useReports.ts`, `src/client/hooks/useReports.test.ts`
  - **Do:**
    | Hook                                                                              | Contract                     | Notes                                                                                                                                                                                                                                                                                          |
    | --------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `useActivity(filter?)`                                                            | `activityContracts.list`     | `GET /api/activity`; **infinite cursor**: `pageParam` → `cursor`; stop when `nextCursor === null`; query `{ type?: ActivityItemType, actorId?, projectId?, from?, to?, cursor?, limit: 1–100 default 20 }` → `{ items, nextCursor: string\|null }`; key `qk.activity('org')` or include filter |
    | `useProjectActivity(projectId, filter?)`                                          | `.listForProject`            | `GET /api/projects/:id/activity`; infinite cursor; key `qk.activity(projectId)`                                                                                                                                                                                                                |
    | `useAudit(filter?)`                                                               | `auditContracts.list`        | infinite cursor; `listAuditQuery`                                                                                                                                                                                                                                                              |
    | `useProjectAudit(projectId, filter?)`                                             | `.listForProject`            | infinite cursor                                                                                                                                                                                                                                                                                |
    | `useProjectReport(id)`                                                            | `reportContracts.project`    | `GET /api/reports/project/:id`                                                                                                                                                                                                                                                                 |
    | `useOrganizationReport`                                                           | `.organization`              | `GET /api/reports/organization`                                                                                                                                                                                                                                                                |
    | `useFinalReport(id)`                                                              | `.final`                     | `GET /api/projects/:id/report/final`                                                                                                                                                                                                                                                           |
    | `useClosurePreflight(id)`                                                         | `closureContracts.preflight` | → `{ projectId, canStart: boolean, blockers: [{ kind, subjectType, subjectId, summary }] }` with `canStart === (blockers.length === 0)`                                                                                                                                                        |
    | `useClosureStatus(id)`                                                            | `.status`                    | → `{ projectId, projectStatus, currentStep, steps[], resumable }`                                                                                                                                                                                                                              |
    | `useStartClosure`                                                                 | `.start`                     | `POST .../closure/start`, void input                                                                                                                                                                                                                                                           |
    | `useCompleteClosure`                                                              | `.complete`                  | `{ confirmCloseCards: literal true, confirmArchive: literal true }`                                                                                                                                                                                                                            |
    | `useExportBudget` / `useExportTransactions` / `useExportCards` / `useExportAudit` | —                            | thin wrappers calling `downloadExport` from F1.1 — **not** `useQuery`                                                                                                                                                                                                                          |
  - **Pattern:** `src/client/hooks/useTransactions.ts` (infinite) + `src/client/api/download.ts` + contracts `activity.ts`, `audit.ts`, `report.ts`, `closure.ts`, `export.ts`
  - **Accept:** `pnpm test client/hooks/useReports` — cursor `getNextPageParam` returns `nextCursor`; export helpers call `downloadExport` not `call`
  - **Notes:** Implemented; `pnpm verify` green.

### F1.13 — Barrel + no direct `call` from UI surfaces

- [x] **F1.13** — Hooks barrel + ESLint: screens/shell must not call `call()`
  - **Files:**
    - `src/client/hooks/index.ts`
    - `eslint.config.mjs` (extend)
    - temporary proof files deleted after
  - **Do:**
    1. Re-export all public hooks from `src/client/hooks/index.ts`.
    2. Extend the F0.15 idea: forbid importing `call` from `@/client/api` (or `@/client/api/client`) inside `src/client/shell/**`, `src/client/states/**`, and `src/app/(app)/**`. Hooks and `src/client/api/**` remain allowed. Message: use a domain hook from `@/client/hooks`.
    3. Proof: temporary file under `src/client/shell/` that imports `call` must fail `pnpm lint`; delete after.
    4. Do **not** forbid `call` inside `src/client/hooks/**`.
  - **Pattern:** F0.15 in `docs/phases/frontend/F0-TASKS.md` + current `eslint.config.mjs`
  - **Accept:** Proof failure observed; proofs deleted; `pnpm lint` green
  - **Notes:** Implemented; `pnpm verify` green.

### F1.14 — Inventory completeness test

- [x] **F1.14** — Every browser-facing contract has exactly one hook
  - **Files:** `src/client/hooks/contractCoverage.test.ts`
  - **Do:**
    1. Import all `*Contracts` objects from `src/shared/contracts` (except `webhookContracts`, `remoteAuthContracts.decide`, `attributeContracts.ingest` — listed exclusions).
    2. Maintain an explicit `Record<string /* contract.method+path */, string /* hookName */>` covering every remaining contract entry.
    3. Test fails if a new contract is added without a map entry, or if two hooks claim the same contract.
    4. Cross-check mutation names ⊆ `Object.keys(invalidationMap)` (ephemeral mutations that invalidate nothing must still appear with `[]`).
  - **Pattern:** `test/helpers/contract.ts` spirit — mechanical completeness, not HTTP
  - **Accept:** `pnpm test client/hooks/contractCoverage`
  - **Notes:** Implemented; `pnpm verify` green.

---

## Phase exit

- [x] All tasks checked and committed
- [x] `pnpm verify` green
- [x] Exactly one hook per browser-facing endpoint (F1.14 green)
- [x] Nothing under shell/states/(app) imports `call()` (F1.13)
- [x] Every hook’s types derive from contracts (no hand-written response interfaces)
- [x] Invalidation map complete vs mutation inventory
- [x] No `4xx` retried (still owned by `createAppQueryClient` — reconfirm `pnpm test client/providers/queryClient`)
- [x] Infinite queries: cursor for activity/audit; page-based for transactions/rule runs (F1.0 locked #1)
- [x] Optimistic updates only freeze/unfreeze + receipt upload/delete; rollback on error
- [x] Removing a field from a contract breaks the hook’s typecheck
- [x] Spec’s review checklist in `F1-data-layer.md` signed off
- [x] `STATUS.md` updated: active phase F2, generate `F2-TASKS.md` when starting F2

## Out of scope (do not do in F1)

- UI components / shadcn (F3)
- Money/date/`can()` utils (F2)
- Product screens (Track A)
- WebSocket/realtime (polling only)
- Changing any B0–B9 contract field names or pagination shapes (F1.0 locked #1 forbids migration)
- Client hooks for webhooks, remote-auth decide, or attribute ingest
