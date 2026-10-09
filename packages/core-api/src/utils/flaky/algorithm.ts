import type { FlakyDetectionConfig } from "../../config.js";
import type { HistoryTestResult } from "../../history.js";
import type { TestResult } from "../../model.js";

export type FlakinessOptions = Pick<
  FlakyDetectionConfig,
  "algorithm" | "pfsThreshold" | "historyDepth" | "stabilizationPeriod"
>;

export abstract class FlakinessAlgorithm {
  protected readonly current: TestResult;
  protected readonly history: (HistoryTestResult | undefined)[];
  protected readonly options: FlakinessOptions;

  constructor(current: TestResult, history: (HistoryTestResult | undefined)[], options: FlakinessOptions = {}) {
    this.current = current;
    this.history = history;
    this.options = options;
  }

  abstract isFlaky(): boolean | undefined;
}
