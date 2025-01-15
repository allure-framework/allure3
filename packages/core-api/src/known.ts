import type { TestLink } from "./metadata.js";
import type { TestError } from "./model.js";

export interface KnownTestFailure {
  historyId: string;
  issues?: TestLink[];
  comment?: string;
  error?: TestError;
}
