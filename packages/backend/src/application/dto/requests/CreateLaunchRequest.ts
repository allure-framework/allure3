import { z } from 'zod';

export interface ExecutorInfoDTO {
  name?: string | null;
  type?: string | null;
  url?: string | null;
  buildOrder?: number | null;
  buildName?: string | null;
  buildUrl?: string | null;
  reportName?: string | null;
  reportUrl?: string | null;
}

export const CreateLaunchRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  executor: z
    .object({
      name: z.string().nullable().optional(),
      type: z.string().nullable().optional(),
      url: z.string().url().nullable().optional(),
      buildOrder: z.number().nullable().optional(),
      buildName: z.string().nullable().optional(),
      buildUrl: z.string().url().nullable().optional(),
      reportName: z.string().nullable().optional(),
      reportUrl: z.string().url().nullable().optional()
    })
    .optional(),
  environment: z.string().max(255).optional(),
  parent_launch_id: z.string().uuid().optional(),
  run_key: z.string().max(255).optional(),
  environment_name: z.string().min(1).max(255).optional(),
  variables: z.record(z.string(), z.string()).optional()
});

export type CreateLaunchRequest = z.infer<typeof CreateLaunchRequestSchema>;
