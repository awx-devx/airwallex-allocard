import { z } from 'zod'
import { defineContract } from '@/shared/contracts/types'
import {
  budgetCategorySchema,
  budgetChangeRequestSchema,
  budgetDetailSchema,
  budgetEntryListSchema,
  budgetEntrySchema,
  budgetHistoryEntrySchema,
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

export const budgetContracts = {
  get: defineContract({
    method: 'GET',
    path: '/api/projects/:id/budget',
    input: z.void(),
    output: budgetDetailSchema,
  }),
  put: defineContract({
    method: 'PUT',
    path: '/api/projects/:id/budget',
    input: putBudgetInput,
    output: budgetDetailSchema,
  }),
  listCategories: defineContract({
    method: 'GET',
    path: '/api/projects/:id/budget/categories',
    input: z.void(),
    output: z.array(budgetCategorySchema),
  }),
  createCategory: defineContract({
    method: 'POST',
    path: '/api/projects/:id/budget/categories',
    input: createBudgetCategoryInput,
    output: budgetCategorySchema,
  }),
  updateCategory: defineContract({
    method: 'PATCH',
    path: '/api/projects/:id/budget/categories/:catId',
    input: updateBudgetCategoryInput,
    output: budgetCategorySchema,
  }),
  deleteCategory: defineContract({
    method: 'DELETE',
    path: '/api/projects/:id/budget/categories/:catId',
    input: z.void(),
    output: z.void(),
  }),
  listEntries: defineContract({
    method: 'GET',
    path: '/api/projects/:id/budget/entries',
    input: listBudgetEntriesQuery,
    output: budgetEntryListSchema,
  }),
  createEntry: defineContract({
    method: 'POST',
    path: '/api/projects/:id/budget/entries',
    input: createBudgetEntryInput,
    output: budgetEntrySchema,
  }),
  history: defineContract({
    method: 'GET',
    path: '/api/projects/:id/budget/history',
    input: z.void(),
    output: z.array(budgetHistoryEntrySchema),
  }),
  listChangeRequests: defineContract({
    method: 'GET',
    path: '/api/projects/:id/budget/change-requests',
    input: z.void(),
    output: z.array(budgetChangeRequestSchema),
  }),
  createChangeRequest: defineContract({
    method: 'POST',
    path: '/api/projects/:id/budget/change-requests',
    input: createBudgetChangeRequestInput,
    output: budgetChangeRequestSchema,
  }),
  decideChangeRequest: defineContract({
    method: 'POST',
    path: '/api/budget/change-requests/:id/decide',
    input: decideBudgetChangeRequestInput,
    output: budgetChangeRequestSchema,
  }),
  validateFormula: defineContract({
    method: 'POST',
    path: '/api/budget/formula/validate',
    input: validateFormulaInput,
    output: validateFormulaOutput,
  }),
} as const

export type BudgetContracts = typeof budgetContracts
