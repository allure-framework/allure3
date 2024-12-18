import type { TestError, TestLink } from "./metadata.js";

export interface KnownTestFailure {
  historyId: string;
  issues?: TestLink[];
  comment?: string;
  error?: TestError;
}
