import { z } from 'zod';

export const CreateVariablesRequestSchema = z.record(z.string(), z.string());

export type CreateVariablesRequest = z.infer<typeof CreateVariablesRequestSchema>;
