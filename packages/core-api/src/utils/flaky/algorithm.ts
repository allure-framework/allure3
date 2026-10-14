import type { FlakyDetectionConfig } from "../../config.js";
import type { HistoryTestResult } from "../../history.js";
import type { TestResult } from "../../model.js";

export type FlakinessOptions = Pick<
  FlakyDetectionConfig,
  "algorithm" | "pfsThreshold" | "historyDepth" | "stabilizationPeriod"
>;

export const DEFAULT_FLAKINESS_OPTIONS: Readonly<Required<FlakinessOptions>> = {
  algorithm: "status-changes",
  historyDepth: 0,
  stabilizationPeriod: 5,
  pfsThreshold: 0.1,
};

export abstract class FlakinessAlgorithm {
  protected readonly current: TestResult;
  protected readonly history: (HistoryTestResult | undefined)[];
  protected readonly options: Required<FlakinessOptions>;

  constructor(current: TestResult, history: (HistoryTestResult | undefined)[], options: FlakinessOptions = {}) {
    this.current = current;
    this.options = {
      algorithm: options.algorithm ?? DEFAULT_FLAKINESS_OPTIONS.algorithm,
      historyDepth: options.historyDepth ?? DEFAULT_FLAKINESS_OPTIONS.historyDepth,
      stabilizationPeriod: options.stabilizationPeriod ?? DEFAULT_FLAKINESS_OPTIONS.stabilizationPeriod,
      pfsThreshold: options.pfsThreshold ?? DEFAULT_FLAKINESS_OPTIONS.pfsThreshold,
    };
    this.history = this.options.historyDepth > 0 ? history.slice(0, this.options.historyDepth) : history;
  }

  abstract isFlaky(): boolean | undefined;
}
