import { ReportFetchError, errorMessageFromUnknown, fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import MiniSearch from "minisearch";
import type { AwesomeSearchDocument } from "types";

import type { StoreSignalState } from "@/stores/types";

const SEARCH_FIELDS: (keyof AwesomeSearchDocument)[] = [
  "id",
  "name",
  "fullName",
  "owner",
  "tags",
  "labels",
  "links",
  "categories",
  "parameters",
  "statusMessage",
  "historyId",
];

const STORE_FIELDS: (keyof AwesomeSearchDocument)[] = ["nodeId", "name"];

export const createSearchIndex = (documents: AwesomeSearchDocument[]) => {
  const searchIndex = new MiniSearch<AwesomeSearchDocument>({
    fields: SEARCH_FIELDS,
    storeFields: STORE_FIELDS,
    searchOptions: {
      combineWith: "AND",
      prefix: true,
      fuzzy: (term) => (term.length > 3 ? 0.2 : false),
      maxFuzzy: 2,
      boost: {
        name: 4,
        fullName: 3,
        owner: 3,
        tags: 2,
        labels: 2,
        links: 1.5,
        categories: 1,
        parameters: 1,
        statusMessage: 0.75,
        historyId: 0.5,
      },
    },
  });

  searchIndex.addAll(documents);

  return searchIndex;
};

export const searchNodeIds = (searchIndex: MiniSearch<AwesomeSearchDocument>, query: string) => {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return new Set<string>();
  }

  return new Set(searchIndex.search(normalizedQuery).map(({ nodeId }) => nodeId));
};

export const searchIndexesStore = signal<StoreSignalState<Record<string, MiniSearch<AwesomeSearchDocument>>>>({
  loading: false,
  error: undefined,
  data: {},
});

const loadingSearchEnvIds = new Set<string>();
const failedSearchEnvIds = new Set<string>();

const searchIndexPath = (env: string) => `widgets/${env}/search-index.json`;
const isMissingSearchIndexError = (error: unknown) =>
  error instanceof ReportFetchError && error.response.status === 404;

export const resetSearchIndexes = () => {
  loadingSearchEnvIds.clear();
  failedSearchEnvIds.clear();
  searchIndexesStore.value = {
    loading: false,
    error: undefined,
    data: {},
  };
};

export const fetchEnvSearchIndexes = async (envs: string[]) => {
  const currentData = searchIndexesStore.peek().data ?? {};
  const envsToFetch = envs.filter(
    (env) => !currentData[env] && !loadingSearchEnvIds.has(env) && !failedSearchEnvIds.has(env),
  );

  if (envsToFetch.length === 0) {
    return;
  }

  envsToFetch.forEach((env) => loadingSearchEnvIds.add(env));

  searchIndexesStore.value = {
    ...searchIndexesStore.peek(),
    loading: true,
    error: undefined,
  };

  try {
    const documentsByEnv = await Promise.allSettled(
      envsToFetch.map(async (env) => ({
        env,
        documents: await fetchReportJsonData<AwesomeSearchDocument[]>(searchIndexPath(env), { bustCache: true }),
      })),
    );
    const loadedSearchIndexes: Record<string, MiniSearch<AwesomeSearchDocument>> = {};
    let error: string | undefined;

    for (const [index, result] of documentsByEnv.entries()) {
      if (result.status === "fulfilled") {
        loadedSearchIndexes[result.value.env] = createSearchIndex(result.value.documents);
        continue;
      }

      if (!error) {
        error = errorMessageFromUnknown(result.reason);
      }

      if (isMissingSearchIndexError(result.reason)) {
        failedSearchEnvIds.add(envsToFetch[index]);
      }
    }

    searchIndexesStore.value = {
      data: {
        ...(searchIndexesStore.peek().data ?? {}),
        ...loadedSearchIndexes,
      },
      loading: false,
      error,
    };
  } catch (e) {
    // Retry malformed/transient responses; only missing search indexes are permanently cached.
    searchIndexesStore.value = {
      ...searchIndexesStore.peek(),
      error: errorMessageFromUnknown(e),
      loading: false,
    };
  } finally {
    envsToFetch.forEach((env) => loadingSearchEnvIds.delete(env));
  }
};
