import { z } from 'zod'
import { defineContract } from '@/shared/contracts/types'
import {
  changeOwnerInput,
  createProjectInput,
  createWorkstreamInput,
  listProjectsQuery,
  projectDetailSchema,
  projectHistoryEntrySchema,
  projectListSchema,
  projectSchema,
  transitionProjectInput,
  updateProjectInput,
  updateWorkstreamInput,
  workstreamSchema,
} from '@/shared/schemas/project'

export const projectContracts = {
  list: defineContract({
    method: 'GET',
    path: '/api/projects',
    input: listProjectsQuery,
    output: projectListSchema,
  }),
  create: defineContract({
    method: 'POST',
    path: '/api/projects',
    input: createProjectInput,
    output: projectSchema,
  }),
  get: defineContract({
    method: 'GET',
    path: '/api/projects/:id',
    input: z.void(),
    output: projectDetailSchema,
  }),
  update: defineContract({
    method: 'PATCH',
    path: '/api/projects/:id',
    input: updateProjectInput,
    output: projectSchema,
  }),
  transition: defineContract({
    method: 'POST',
    path: '/api/projects/:id/transition',
    input: transitionProjectInput,
    output: projectSchema,
  }),
  listWorkstreams: defineContract({
    method: 'GET',
    path: '/api/projects/:id/workstreams',
    input: z.void(),
    output: z.array(workstreamSchema),
  }),
  createWorkstream: defineContract({
    method: 'POST',
    path: '/api/projects/:id/workstreams',
    input: createWorkstreamInput,
    output: workstreamSchema,
  }),
  updateWorkstream: defineContract({
    method: 'PATCH',
    path: '/api/projects/:id/workstreams/:wsId',
    input: updateWorkstreamInput,
    output: workstreamSchema,
  }),
  deleteWorkstream: defineContract({
    method: 'DELETE',
    path: '/api/projects/:id/workstreams/:wsId',
    input: z.void(),
    output: z.void(),
  }),
  changeOwner: defineContract({
    method: 'PATCH',
    path: '/api/projects/:id/owner',
    input: changeOwnerInput,
    output: projectSchema,
  }),
  history: defineContract({
    method: 'GET',
    path: '/api/projects/:id/history',
    input: z.void(),
    output: z.array(projectHistoryEntrySchema),
  }),
} as const

export type ProjectContracts = typeof projectContracts
