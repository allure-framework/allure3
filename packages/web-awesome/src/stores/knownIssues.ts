import { ReportFetchError, errorMessageFromUnknown, fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import type { AwesomeKnownIssues } from "types";

import type { StoreSignalState } from "@/stores/types";

export const knownIssuesStore = signal<StoreSignalState<AwesomeKnownIssues>>({
  loading: true,
  error: undefined,
  data: undefined,
});

let lastKnownIssuesEnv: string | undefined;

const emptyKnownIssues: AwesomeKnownIssues = {
  issues: [],
  testResultsByIssueId: {},
};

const resolveKnownIssuesPath = (env?: string) =>
  env ? `widgets/${env}/known-issues.json` : "widgets/known-issues.json";

const isMissingKnownIssuesError = (error: unknown) =>
  error instanceof ReportFetchError && error.response.status === 404;

export const fetchKnownIssuesData = async (env?: string) => {
  if (lastKnownIssuesEnv === env && knownIssuesStore.peek().data) {
    return;
  }
  lastKnownIssuesEnv = env;
  knownIssuesStore.value = {
    ...knownIssuesStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const data = await fetchReportJsonData<AwesomeKnownIssues>(resolveKnownIssuesPath(env));

    knownIssuesStore.value = {
      data,
      error: undefined,
      loading: false,
    };
  } catch (error) {
    if (!isMissingKnownIssuesError(error)) {
      knownIssuesStore.value = {
        data: undefined,
        error: errorMessageFromUnknown(error),
        loading: false,
      };
      lastKnownIssuesEnv = undefined;
      return;
    }

    knownIssuesStore.value = {
      data: emptyKnownIssues,
      error: undefined,
      loading: false,
    };
  }
};
