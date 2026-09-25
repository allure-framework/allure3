import type { TestResult } from "@allurereport/core-api";

const NO_RETRIES: TestResult[] = [];

export class RetrySubstore {
  readonly #testResultsByRetryHash = new Map<string, TestResult[]>();
  readonly #testResultIngestIndexById = new Map<string, number>();

  recordIngestOrder(testResultId: string) {
    if (this.#testResultIngestIndexById.has(testResultId)) {
      return;
    }

    this.#testResultIngestIndexById.set(testResultId, this.#testResultIngestIndexById.size);
  }

  resetIngestOrder() {
    this.#testResultIngestIndexById.clear();
  }

  restoreIngestOrder(restoredIds: string[] | undefined, hasTestResult: (testResultId: string) => boolean) {
    for (const id of restoredIds ?? []) {
      if (!hasTestResult(id) || this.#testResultIngestIndexById.has(id)) {
        continue;
      }

      this.#testResultIngestIndexById.set(id, this.#testResultIngestIndexById.size);
    }
  }

  ingestOrderIdsForDump(): string[] {
    return Array.from(this.#testResultIngestIndexById.keys());
  }

  #getIngestIndex(testResultId: string): number {
    return this.#testResultIngestIndexById.get(testResultId) ?? -1;
  }

  #compareResults(first: TestResult, second: TestResult): -1 | 0 | 1 {
    const firstHasStart = typeof first.start === "number";
    const secondHasStart = typeof second.start === "number";

    if (firstHasStart !== secondHasStart) {
      return firstHasStart ? 1 : -1;
    }

    if (firstHasStart && secondHasStart && first.start !== second.start) {
      return first.start! > second.start! ? -1 : 1;
    }

    const indexA = this.#getIngestIndex(first.id);
    const indexB = this.#getIngestIndex(second.id);

    if (indexA !== indexB) {
      return indexA > indexB ? -1 : 1;
    }

    return 0;
  }

  upsert(testResult: TestResult) {
    testResult.isRetry = false;

    if (!testResult.retryHash) {
      return;
    }

    const results = this.#testResultsByRetryHash.get(testResult.retryHash);

    if (!results) {
      this.#testResultsByRetryHash.set(testResult.retryHash, [testResult]);
      return;
    }

    results.push(testResult);
    results.sort((first, second) => this.#compareResults(first, second));

    results.forEach((attempt, index) => {
      attempt.isRetry = index !== 0;
    });
  }

  retriesByTr(testResult: TestResult): TestResult[] {
    if (!testResult.retryHash || testResult.isRetry) {
      return NO_RETRIES;
    }

    const attempts = this.#testResultsByRetryHash.get(testResult.retryHash) ?? [];
    const index = attempts.findIndex((attempt) => attempt.id === testResult.id);

    if (index !== 0) {
      return NO_RETRIES;
    }

    return attempts.slice(1);
  }

  reset() {
    this.#testResultsByRetryHash.clear();
  }
}
