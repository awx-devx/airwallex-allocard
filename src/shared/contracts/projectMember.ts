import { z } from 'zod'
import { defineContract } from '@/shared/contracts/types'
import {
  accessHistoryEntrySchema,
  addProjectMemberInput,
  previewProjectMemberInput,
  previewProjectMemberOutput,
  projectMemberDetailSchema,
  updateProjectMemberInput,
} from '@/shared/schemas/projectMember'

export const projectMemberContracts = {
  list: defineContract({
    method: 'GET',
    path: '/api/projects/:id/members',
    input: z.void(),
    output: z.array(projectMemberDetailSchema),
  }),
  add: defineContract({
    method: 'POST',
    path: '/api/projects/:id/members',
    input: addProjectMemberInput,
    output: projectMemberDetailSchema,
  }),
  update: defineContract({
    method: 'PATCH',
    path: '/api/projects/:id/members/:userId',
    input: updateProjectMemberInput,
    output: projectMemberDetailSchema,
  }),
  remove: defineContract({
    method: 'DELETE',
    path: '/api/projects/:id/members/:userId',
    input: z.void(),
    output: z.void(),
  }),
  preview: defineContract({
    method: 'POST',
    path: '/api/projects/:id/members/preview',
    input: previewProjectMemberInput,
    output: previewProjectMemberOutput,
  }),
  accessHistory: defineContract({
    method: 'GET',
    path: '/api/projects/:id/access-history',
    input: z.void(),
    output: z.array(accessHistoryEntrySchema),
  }),
} as const

export type ProjectMemberContracts = typeof projectMemberContracts
