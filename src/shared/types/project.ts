import { z } from 'zod'
import {
  cardStructureSchema,
  changeOwnerInput,
  createProjectInput,
  createWorkstreamInput,
  listProjectsQuery,
  projectDetailSchema,
  projectHistoryEntrySchema,
  projectListSchema,
  projectOverviewSchema,
  projectReadyForApproval,
  projectSchema,
  projectSortSchema,
  transitionProjectInput,
  updateProjectInput,
  updateWorkstreamInput,
  workstreamSchema,
} from '@/shared/schemas/project'

export type Workstream = z.infer<typeof workstreamSchema>
export type CardStructure = z.infer<typeof cardStructureSchema>
export type Project = z.infer<typeof projectSchema>
export type ProjectOverview = z.infer<typeof projectOverviewSchema>
export type ProjectDetail = z.infer<typeof projectDetailSchema>
export type CreateProjectInput = z.infer<typeof createProjectInput>
export type UpdateProjectInput = z.infer<typeof updateProjectInput>
export type ProjectReadyForApproval = z.infer<typeof projectReadyForApproval>
export type TransitionProjectInput = z.infer<typeof transitionProjectInput>
export type ListProjectsQuery = z.infer<typeof listProjectsQuery>
export type ProjectSort = z.infer<typeof projectSortSchema>
export type ProjectList = z.infer<typeof projectListSchema>
export type CreateWorkstreamInput = z.infer<typeof createWorkstreamInput>
export type UpdateWorkstreamInput = z.infer<typeof updateWorkstreamInput>
export type ChangeOwnerInput = z.infer<typeof changeOwnerInput>
export type ProjectHistoryEntry = z.infer<typeof projectHistoryEntrySchema>
