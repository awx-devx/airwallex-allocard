import { z } from 'zod'
import {
  budgetCategorySchema,
  budgetChangeRequestSchema,
  budgetDetailSchema,
  budgetEntryListSchema,
  budgetEntrySchema,
  budgetHistoryEntrySchema,
  budgetProjectionSchema,
  budgetSchema,
  budgetSnapshotSchema,
  createBudgetCategoryInput,
  createBudgetChangeRequestInput,
  createBudgetEntryInput,
  decideBudgetChangeRequestInput,
  listBudgetEntriesQuery,
  putBudgetInput,
  updateBudgetCategoryInput,
  validateFormulaInput,
  validateFormulaOutput,
} from '@/shared/schemas/budget'

export type BudgetCategory = z.infer<typeof budgetCategorySchema>
export type Budget = z.infer<typeof budgetSchema>
export type BudgetProjection = z.infer<typeof budgetProjectionSchema>
export type BudgetSnapshot = z.infer<typeof budgetSnapshotSchema>
export type BudgetDetail = z.infer<typeof budgetDetailSchema>
export type PutBudgetInput = z.infer<typeof putBudgetInput>
export type CreateBudgetCategoryInput = z.infer<typeof createBudgetCategoryInput>
export type UpdateBudgetCategoryInput = z.infer<typeof updateBudgetCategoryInput>
export type BudgetEntry = z.infer<typeof budgetEntrySchema>
export type ListBudgetEntriesQuery = z.infer<typeof listBudgetEntriesQuery>
export type BudgetEntryList = z.infer<typeof budgetEntryListSchema>
export type CreateBudgetEntryInput = z.infer<typeof createBudgetEntryInput>
export type BudgetChangeRequest = z.infer<typeof budgetChangeRequestSchema>
export type CreateBudgetChangeRequestInput = z.infer<typeof createBudgetChangeRequestInput>
export type DecideBudgetChangeRequestInput = z.infer<typeof decideBudgetChangeRequestInput>
export type ValidateFormulaInput = z.infer<typeof validateFormulaInput>
export type ValidateFormulaOutput = z.infer<typeof validateFormulaOutput>
export type BudgetHistoryEntry = z.infer<typeof budgetHistoryEntrySchema>
