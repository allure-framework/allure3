import type { TestLink } from "./metadata.js";
import type { TestError } from "./model.js";

export interface KnownTestFailure {
  /** @deprecated Prefer `historyHash`. */
  historyId?: string;
  historyHash?: string;
  issues?: TestLink[];
  comment?: string;
  error?: TestError;
}
