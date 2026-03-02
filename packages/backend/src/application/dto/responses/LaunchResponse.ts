import type { Statistic } from '@allurereport/core-api';
import type { ExecutorInfoDTO } from '../requests/CreateLaunchRequest.js';

export interface LaunchResponse {
  id: string;
  name: string;
  startTime: string; // ISO 8601
  stopTime: string | null; // ISO 8601
  executor: ExecutorInfoDTO | null;
  environment: string | null;
  reportUuid: string | null;
  statistic: Statistic;
  testResultsCount: number;
  duration: number | null; // milliseconds
}
