import { z } from 'zod'
import { defineContract } from '@/shared/contracts/types'
import { membershipSchema, updateMemberInput } from '@/shared/schemas/membership'
import {
  createOrganizationInput,
  organizationSchema,
  updateOrganizationInput,
} from '@/shared/schemas/organization'

export const organizationContracts = {
  create: defineContract({
    method: 'POST',
    path: '/api/organizations',
    input: createOrganizationInput,
    output: organizationSchema,
  }),
  get: defineContract({
    method: 'GET',
    path: '/api/organizations/:id',
    input: z.void(),
    output: organizationSchema,
  }),
  update: defineContract({
    method: 'PATCH',
    path: '/api/organizations/:id',
    input: updateOrganizationInput,
    output: organizationSchema,
  }),
  listMembers: defineContract({
    method: 'GET',
    path: '/api/organizations/:id/members',
    input: z.void(),
    output: z.array(membershipSchema),
  }),
  updateMember: defineContract({
    method: 'PATCH',
    path: '/api/organizations/:id/members/:userId',
    input: updateMemberInput,
    output: membershipSchema,
  }),
  removeMember: defineContract({
    method: 'DELETE',
    path: '/api/organizations/:id/members/:userId',
    input: z.void(),
    output: z.void(),
  }),
} as const

export type OrganizationContracts = typeof organizationContracts
