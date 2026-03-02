import { z } from 'zod';

export const SearchTestResultsRequestSchema = z.object({
  query: z.string().optional(),
  status: z.enum(['failed', 'broken', 'passed', 'skipped', 'unknown']).optional(),
  labelName: z.string().optional(),
  labelValue: z.string().optional(),
  environment: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20)
});

export type SearchTestResultsRequest = z.infer<typeof SearchTestResultsRequestSchema>;
