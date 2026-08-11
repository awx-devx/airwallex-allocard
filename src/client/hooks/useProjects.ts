'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { invalidateFor } from '@/client/hooks/invalidationMap'
import type { ContractCaller } from '@/client/hooks/useSession'
import { useCall } from '@/client/hooks/useCall'
import { qk, type ProjectFilter } from '@/client/queryKeys'
import { projectContracts } from '@/shared/contracts/project'

export function projectsQueryOptions(
  filter: ProjectFilter | undefined,
  callWithOrg: ContractCaller,
) {
  return {
    queryKey: qk.projects(filter),
    queryFn: () => callWithOrg(projectContracts.list, { input: filter }),
  }
}

export function projectQueryOptions(id: string, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.project(id),
    queryFn: () => callWithOrg(projectContracts.get, { params: { id } }),
    enabled: Boolean(id),
  }
}

export function workstreamsQueryOptions(id: string, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.workstreams(id),
    queryFn: () => callWithOrg(projectContracts.listWorkstreams, { params: { id } }),
    enabled: Boolean(id),
  }
}

export function projectHistoryQueryOptions(id: string, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.projectHistory(id),
    queryFn: () => callWithOrg(projectContracts.history, { params: { id } }),
    enabled: Boolean(id),
  }
}

export function useProjects(filter?: ProjectFilter) {
  const callWithOrg = useCall()
  return useQuery(projectsQueryOptions(filter, callWithOrg))
}

export function useProject(id: string) {
  const callWithOrg = useCall()
  return useQuery(projectQueryOptions(id, callWithOrg))
}

export function useCreateProject() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: (input: z.infer<typeof projectContracts.create.input>) =>
      callWithOrg(projectContracts.create, { input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useCreateProject', { variables, data })
    },
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: z.infer<typeof projectContracts.update.input>
    }) => callWithOrg(projectContracts.update, { params: { id }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useUpdateProject', { variables, data })
    },
  })
}

export function useTransitionProject() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: z.infer<typeof projectContracts.transition.input>
    }) => callWithOrg(projectContracts.transition, { params: { id }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useTransitionProject', { variables, data })
    },
  })
}

export function useWorkstreams(id: string) {
  const callWithOrg = useCall()
  return useQuery(workstreamsQueryOptions(id, callWithOrg))
}

export function useCreateWorkstream() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: z.infer<typeof projectContracts.createWorkstream.input>
    }) => callWithOrg(projectContracts.createWorkstream, { params: { id }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useCreateWorkstream', { variables, data })
    },
  })
}

export function useUpdateWorkstream() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      wsId,
      input,
    }: {
      id: string
      wsId: string
      input: z.infer<typeof projectContracts.updateWorkstream.input>
    }) => callWithOrg(projectContracts.updateWorkstream, { params: { id, wsId }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useUpdateWorkstream', { variables, data })
    },
  })
}

export function useDeleteWorkstream() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({ id, wsId }: { id: string; wsId: string }) =>
      callWithOrg(projectContracts.deleteWorkstream, { params: { id, wsId } }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useDeleteWorkstream', { variables, data })
    },
  })
}

export function useChangeProjectOwner() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: z.infer<typeof projectContracts.changeOwner.input>
    }) => callWithOrg(projectContracts.changeOwner, { params: { id }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useChangeProjectOwner', { variables, data })
    },
  })
}

export function useProjectHistory(id: string) {
  const callWithOrg = useCall()
  return useQuery(projectHistoryQueryOptions(id, callWithOrg))
}
