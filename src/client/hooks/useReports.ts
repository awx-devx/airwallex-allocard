'use client'

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { downloadExport, type ExportKind } from '@/client/api/download'
import { invalidateFor } from '@/client/hooks/invalidationMap'
import type { ContractCaller } from '@/client/hooks/useSession'
import { useCall } from '@/client/hooks/useCall'
import { qk, type AuditFilter } from '@/client/queryKeys'
import { activityContracts } from '@/shared/contracts/activity'
import { auditContracts } from '@/shared/contracts/audit'
import { closureContracts } from '@/shared/contracts/closure'
import { reportContracts } from '@/shared/contracts/report'
import type { ExportInput } from '@/shared/types/export'
import type { ListActivityQuery } from '@/shared/types/activity'

type ActivityPage = z.infer<typeof activityContracts.list.output>
type AuditPage = z.infer<typeof auditContracts.list.output>

function cursorNextParam(last: { nextCursor: string | null }): string | undefined {
  return last.nextCursor ?? undefined
}

export function activityInfiniteQueryOptions(
  filter: ListActivityQuery | undefined,
  callWithOrg: ContractCaller,
) {
  return {
    queryKey: qk.activity(),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      callWithOrg(activityContracts.list, {
        input: { ...filter, cursor: pageParam } as z.infer<typeof activityContracts.list.input>,
      }),
    getNextPageParam: cursorNextParam,
  }
}

export function projectActivityInfiniteQueryOptions(
  projectId: string,
  filter: ListActivityQuery | undefined,
  callWithOrg: ContractCaller,
) {
  return {
    queryKey: qk.activity(projectId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      callWithOrg(activityContracts.listForProject, {
        params: { id: projectId },
        input: { ...filter, cursor: pageParam } as z.infer<
          typeof activityContracts.listForProject.input
        >,
      }),
    getNextPageParam: cursorNextParam,
    enabled: Boolean(projectId),
  }
}

export function auditInfiniteQueryOptions(
  filter: AuditFilter | undefined,
  callWithOrg: ContractCaller,
) {
  return {
    queryKey: qk.audit(filter),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      callWithOrg(auditContracts.list, {
        input: { ...filter, cursor: pageParam } as z.infer<typeof auditContracts.list.input>,
      }),
    getNextPageParam: cursorNextParam,
  }
}

export function projectAuditInfiniteQueryOptions(
  projectId: string,
  filter: AuditFilter | undefined,
  callWithOrg: ContractCaller,
) {
  const mergedFilter = { ...filter, projectId } as AuditFilter
  return {
    queryKey: qk.audit(mergedFilter),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      callWithOrg(auditContracts.listForProject, {
        params: { id: projectId },
        input: { ...filter, cursor: pageParam } as z.infer<
          typeof auditContracts.listForProject.input
        >,
      }),
    getNextPageParam: cursorNextParam,
    enabled: Boolean(projectId),
  }
}

export function projectReportQueryOptions(id: string, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.projectReport(id),
    queryFn: () => callWithOrg(reportContracts.project, { params: { id } }),
    enabled: Boolean(id),
  }
}

export function organizationReportQueryOptions(callWithOrg: ContractCaller) {
  return {
    queryKey: qk.organizationReport(),
    queryFn: () => callWithOrg(reportContracts.organization),
  }
}

export function finalReportQueryOptions(id: string, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.finalReport(id),
    queryFn: () => callWithOrg(reportContracts.final, { params: { id } }),
    enabled: Boolean(id),
  }
}

export function closurePreflightQueryOptions(id: string, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.closurePreflight(id),
    queryFn: () => callWithOrg(closureContracts.preflight, { params: { id } }),
    enabled: Boolean(id),
  }
}

export function closureStatusQueryOptions(id: string, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.closureStatus(id),
    queryFn: () => callWithOrg(closureContracts.status, { params: { id } }),
    enabled: Boolean(id),
  }
}

function useExportMutation(kind: ExportKind) {
  return useMutation({
    mutationFn: (input: ExportInput) => downloadExport(kind, input),
  })
}

export function useActivity(filter?: ListActivityQuery) {
  const callWithOrg = useCall()
  return useInfiniteQuery(activityInfiniteQueryOptions(filter, callWithOrg))
}

export function useProjectActivity(projectId: string, filter?: ListActivityQuery) {
  const callWithOrg = useCall()
  return useInfiniteQuery(projectActivityInfiniteQueryOptions(projectId, filter, callWithOrg))
}

export function useAudit(filter?: AuditFilter) {
  const callWithOrg = useCall()
  return useInfiniteQuery(auditInfiniteQueryOptions(filter, callWithOrg))
}

export function useProjectAudit(projectId: string, filter?: AuditFilter) {
  const callWithOrg = useCall()
  return useInfiniteQuery(projectAuditInfiniteQueryOptions(projectId, filter, callWithOrg))
}

export function useProjectReport(id: string) {
  const callWithOrg = useCall()
  return useQuery(projectReportQueryOptions(id, callWithOrg))
}

export function useOrganizationReport() {
  const callWithOrg = useCall()
  return useQuery(organizationReportQueryOptions(callWithOrg))
}

export function useFinalReport(id: string) {
  const callWithOrg = useCall()
  return useQuery(finalReportQueryOptions(id, callWithOrg))
}

export function useClosurePreflight(id: string) {
  const callWithOrg = useCall()
  return useQuery(closurePreflightQueryOptions(id, callWithOrg))
}

export function useClosureStatus(id: string) {
  const callWithOrg = useCall()
  return useQuery(closureStatusQueryOptions(id, callWithOrg))
}

export function useStartClosure() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({ id }: { id: string }) => callWithOrg(closureContracts.start, { params: { id } }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useStartClosure', { variables, data })
    },
  })
}

export function useCompleteClosure() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: z.infer<typeof closureContracts.complete.input>
    }) => callWithOrg(closureContracts.complete, { params: { id }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useCompleteClosure', { variables, data })
    },
  })
}

export function useExportBudget() {
  return useExportMutation('budget')
}

export function useExportTransactions() {
  return useExportMutation('transactions')
}

export function useExportCards() {
  return useExportMutation('cards')
}

export function useExportAudit() {
  return useExportMutation('audit')
}

export { cursorNextParam }
export type { ActivityPage, AuditPage }
