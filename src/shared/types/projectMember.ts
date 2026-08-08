import { z } from 'zod'
import {
  accessHistoryEntrySchema,
  addProjectMemberInput,
  permissionReasonSchema,
  previewProjectMemberInput,
  previewProjectMemberOutput,
  projectMemberDetailSchema,
  projectMemberSchema,
  updateProjectMemberInput,
} from '@/shared/schemas/projectMember'

export type ProjectMember = z.infer<typeof projectMemberSchema>
export type ProjectMemberDetail = z.infer<typeof projectMemberDetailSchema>
export type AddProjectMemberInput = z.infer<typeof addProjectMemberInput>
export type UpdateProjectMemberInput = z.infer<typeof updateProjectMemberInput>
export type PreviewProjectMemberInput = z.infer<typeof previewProjectMemberInput>
export type PreviewProjectMemberOutput = z.infer<typeof previewProjectMemberOutput>
export type PermissionReason = z.infer<typeof permissionReasonSchema>
export type AccessHistoryEntry = z.infer<typeof accessHistoryEntrySchema>
