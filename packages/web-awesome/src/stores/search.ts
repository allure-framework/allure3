import { ReportFetchError, errorMessageFromUnknown, fetchReportJsonData } from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import type { ReportSearchDocument } from "types";

import type { StoreSignalState } from "@/stores/types";

const SEARCH_FIELDS: (keyof ReportSearchDocument)[] = [
  "id",
  "name",
  "titlePath",
  "fullName",
  "owner",
  "tags",
  "labels",
  "links",
  "categories",
  "parameters",
  "statusMessage",
  "retryHash",
];

const STORE_FIELDS: (keyof ReportSearchDocument)[] = ["nodeId", "name"];

const isFuzzySearchTerm = (term: string) => /^\p{L}+$/u.test(term) && term.length > 3;
const normalizeSearchValue = (value: string) => value.toLocaleLowerCase();
const tokenizeWordSearchTerms = (value: string) => value.match(/[\p{L}\p{M}]+/gu) ?? [];

type SearchIndexDocument = Pick<ReportSearchDocument, (typeof STORE_FIELDS)[number]> & {
  text: string;
  fuzzyTerms: string[];
};

export type ReportSearchIndex = {
  documents: SearchIndexDocument[];
};

const fuzzyDistance = (left: string, right: string, maxDistance: number) => {
  if (Math.abs(left.length - right.length) > maxDistance) {
    return maxDistance + 1;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 0; leftIndex < left.length; leftIndex++) {
    const current = [leftIndex + 1];
    let rowMin = current[0]!;

    for (let rightIndex = 0; rightIndex < right.length; rightIndex++) {
      const cost = left[leftIndex] === right[rightIndex] ? 0 : 1;
      const value = Math.min(previous[rightIndex + 1]! + 1, current[rightIndex]! + 1, previous[rightIndex]! + cost);

      current.push(value);
      rowMin = Math.min(rowMin, value);
    }

    if (rowMin > maxDistance) {
      return maxDistance + 1;
    }

    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length]!;
};

const fuzzyMatches = (term: string, fuzzyTerms: string[]) => {
  if (!isFuzzySearchTerm(term)) {
    return false;
  }

  const maxDistance = Math.min(2, Math.floor(term.length * 0.2));

  if (maxDistance < 1) {
    return false;
  }

  return fuzzyTerms.some(
    (candidate) =>
      candidate[0] === term[0] &&
      Math.abs(candidate.length - term.length) <= maxDistance &&
      fuzzyDistance(term, candidate, maxDistance) <= maxDistance,
  );
};

const textMatchesTerm = (text: string, fuzzyTerms: string[], term: string) => {
  if (text.includes(term)) {
    return true;
  }

  const tokens = tokenizeWordSearchTerms(term);

  return (
    fuzzyMatches(term, fuzzyTerms) ||
    (tokens.length > 1 && tokens.every((token) => text.includes(token) || fuzzyMatches(token, fuzzyTerms)))
  );
};

export const createSearchIndex = (documents: ReportSearchDocument[]): ReportSearchIndex => {
  return {
    documents: documents.map((document) => {
      const values = SEARCH_FIELDS.map((field) => document[field])
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .map(normalizeSearchValue);
      const text = values.join(" ");

      return {
        nodeId: document.nodeId,
        name: document.name,
        text,
        fuzzyTerms: [...new Set(tokenizeWordSearchTerms(text).filter(isFuzzySearchTerm))],
      };
    }),
  };
};

export const searchNodeIds = (searchIndex: ReportSearchIndex, query: string) => {
  const terms = query.trim().split(/\s+/).filter(Boolean).map(normalizeSearchValue);

  if (terms.length === 0) {
    return new Set<string>();
  }

  return new Set(
    searchIndex.documents
      .filter(({ text, fuzzyTerms }) => terms.every((term) => textMatchesTerm(text, fuzzyTerms, term)))
      .map(({ nodeId }) => nodeId),
  );
};

export const searchIndexesStore = signal<StoreSignalState<Record<string, ReportSearchIndex>>>({
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
        documents: await fetchReportJsonData<ReportSearchDocument[]>(searchIndexPath(env), { bustCache: true }),
      })),
    );
    const loadedSearchIndexes: Record<string, ReportSearchIndex> = {};
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
