import type { TestLink } from "./metadata.js";
import type { TestError } from "./model.js";

export interface QuarantineTestFailure {
  historyId: string;
  error?: TestError;
}

export interface KnownTestFailure extends QuarantineTestFailure {
  issues?: TestLink[];
  comment?: string;
}
