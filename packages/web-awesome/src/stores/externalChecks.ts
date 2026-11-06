import type { AllureCheckResult } from "@allurereport/core-api";
import { ReportFetchError, errorMessageFromUnknown, fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";

import type { StoreSignalState } from "@/stores/types";

export type ExternalCheckResult = Omit<AllureCheckResult, "details"> & {
  details?: AllureCheckResult["details"] & { url?: string };
};

type ReportSummary = {
  checks?: ExternalCheckResult[];
};

export const externalChecksStore = signal<StoreSignalState<Record<string, ExternalCheckResult>>>({
  loading: true,
  error: undefined,
  data: undefined,
});

const toRecord = (checks: ExternalCheckResult[]) => Object.fromEntries(checks.map((check) => [check.id, check]));

export const fetchExternalChecks = async () => {
  externalChecksStore.value = {
    ...externalChecksStore.peek(),
    loading: true,
    error: undefined,
  };

  try {
    const data = await fetchReportJsonData<Record<string, ExternalCheckResult>>("widgets/check-results.json", {
      bustCache: true,
    });

    externalChecksStore.value = { data, error: undefined, loading: false };
    return;
  } catch (err) {
    if (!(err instanceof ReportFetchError) || err.response.status !== 404) {
      externalChecksStore.value = { data: undefined, error: errorMessageFromUnknown(err), loading: false };
      return;
    }
  }

  try {
    const summary = await fetchReportJsonData<ReportSummary>("summary.json", { bustCache: true });

    externalChecksStore.value = {
      data: toRecord(summary.checks ?? []),
      error: undefined,
      loading: false,
    };
  } catch (err) {
    if (err instanceof ReportFetchError && err.response.status === 404) {
      externalChecksStore.value = { data: undefined, error: undefined, loading: false };
      return;
    }

    externalChecksStore.value = { data: undefined, error: errorMessageFromUnknown(err), loading: false };
  }
};
