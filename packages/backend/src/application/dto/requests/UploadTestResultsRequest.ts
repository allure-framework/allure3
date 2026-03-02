import { z } from 'zod';
import type { TestResult as TestResultDTO } from '@allurereport/core-api';

export const UploadTestResultsRequestSchema = z.object({
  results: z.array(z.any()).min(1) // TestResultDTO[] from @allurereport/core-api
});

export type UploadTestResultsRequest = z.infer<typeof UploadTestResultsRequestSchema>;

export interface UploadTestResultsRequestData {
  results: TestResultDTO[];
}
