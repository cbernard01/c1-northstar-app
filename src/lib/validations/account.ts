import { z } from 'zod';

// Company size enum
export const companySizeSchema = z.enum(['startup', 'small', 'medium', 'large', 'enterprise']);

// Create account validation
export const createAccountSchema = z.object({
  name: z.string().min(1, 'Company name is required').max(200),
  domain: z.string().url().or(z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/, 'Invalid domain format')).optional(),
  industry: z.string().max(100).optional(),
  size: companySizeSchema.optional(),
  location: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  website: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
});

// Update account validation
export const updateAccountSchema = createAccountSchema.partial();

// Account query parameters validation
export const accountQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  industry: z.string().optional(),
  size: companySizeSchema.optional(),
  location: z.string().optional(),
  technology: z.string().optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'industry', 'size']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  includeFacets: z.coerce.boolean().default(false),
});

// Bulk account operations validation
export const bulkAccountIdsSchema = z.object({
  ids: z.array(z.string().cuid()).min(1, 'At least one account ID is required'),
});

export const bulkUpdateAccountsSchema = z.object({
  ids: z.array(z.string().cuid()).min(1),
  updates: updateAccountSchema,
});

// Contact validation
export const createContactSchema = z.object({
  name: z.string().min(1, 'Contact name is required').max(200),
  email: z.string().email().optional(),
  title: z.string().max(200).optional(),
  department: z.string().max(100).optional(),
  linkedIn: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
});

export const updateContactSchema = createContactSchema.partial();

// Technology validation
export const createTechnologySchema = z.object({
  name: z.string().min(1, 'Technology name is required').max(100),
  category: z.string().max(50),
  version: z.string().max(50).optional(),
  confidence: z.number().min(0).max(1).default(0),
  source: z.string().max(100),
  metadata: z.record(z.any()).optional(),
});

export const updateTechnologySchema = createTechnologySchema.partial();

// Type exports
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type AccountQueryParams = z.infer<typeof accountQuerySchema>;
export type BulkAccountIds = z.infer<typeof bulkAccountIdsSchema>;
export type BulkUpdateAccounts = z.infer<typeof bulkUpdateAccountsSchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type CreateTechnologyInput = z.infer<typeof createTechnologySchema>;
export type UpdateTechnologyInput = z.infer<typeof updateTechnologySchema>;