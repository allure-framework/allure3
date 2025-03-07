import type { EnvironmentsConfig } from "../environment.js";
import type { TestResult } from "../model.js";

export const matchEnvironment = (envConfig: EnvironmentsConfig, tr: TestResult): string => {
  return Object.entries(envConfig).find(([, { matcher }]) => matcher({ labels: tr.labels }))?.[0] ?? "default";
};
