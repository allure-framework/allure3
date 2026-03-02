import type { EnvironmentItem, TestError } from '@allurereport/core-api';

export interface LaunchGlobalsData {
  launchId: string;
  exitCodeOriginal: number;
  exitCodeActual: number | null;
  errors: TestError[];
  allureEnvironment?: EnvironmentItem[];
}

export interface ILaunchGlobalsRepository {
  save(data: LaunchGlobalsData): Promise<void>;
  findByLaunchId(launchId: string): Promise<LaunchGlobalsData | null>;
}
