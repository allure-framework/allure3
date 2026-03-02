import { z } from 'zod';

export const CreateGlobalsRequestSchema = z.object({
  exitCode: z
    .object({
      original: z.number(),
      actual: z.number().optional()
    })
    .optional(),
  errors: z
    .array(
      z.object({
        message: z.string().optional(),
        trace: z.string().optional(),
        actual: z.string().optional(),
        expected: z.string().optional()
      })
    )
    .optional(),
  allureEnvironment: z
    .array(z.object({ name: z.string(), values: z.array(z.string()) }))
    .optional()
});

export type CreateGlobalsRequest = z.infer<typeof CreateGlobalsRequestSchema>;
