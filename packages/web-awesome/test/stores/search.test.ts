import type { AwesomeSearchDocument } from "types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchReportJsonDataMock } = vi.hoisted(() => ({
  fetchReportJsonDataMock: vi.fn(),
}));

vi.mock("@allurereport/web-commons", async () => {
  const actual = await vi.importActual<typeof import("@allurereport/web-commons")>("@allurereport/web-commons");

  return {
    ...actual,
    fetchReportJsonData: fetchReportJsonDataMock,
  };
});

import { ReportFetchError } from "@allurereport/web-commons";

import {
  createSearchIndex,
  fetchEnvSearchIndexes,
  resetSearchIndexes,
  searchIndexesStore,
  searchNodeIds,
} from "../../src/stores/search.js";

const documents: AwesomeSearchDocument[] = [
  {
    id: "tr-1",
    nodeId: "tr-1",
    name: "renders request form",
    fullName: "forms.RequestWithDatesFormTest.shouldRender",
    historyId: "history-request-form",
    owner: "Igor Martynov",
    labels: "feature:Forms Forms",
    tags: "smoke",
    parameters: "browser:chromium browser chromium",
    categories: "Product defects",
    statusMessage: "Date format assertion failed",
    links: "ISSUE-42 https://example.com/ISSUE-42 issue",
  },
  {
    id: "tr-2",
    nodeId: "tr-2",
    name: "submits checkout",
    fullName: "checkout.SubmitCheckoutTest.shouldSubmit",
    owner: "Jane Smith",
    labels: "feature:Checkout Checkout",
    tags: "regression",
    parameters: "region:eu region eu",
    categories: "Infrastructure",
    statusMessage: "Network timeout",
    links: "PAYMENTS-932 https://example.com/PAYMENTS-932 issue",
  },
];

type SearchCase = [string, AwesomeSearchDocument[], string, string[]];
type SearchFindCase = [string, string[]];

describe("stores > search", () => {
  beforeEach(() => {
    fetchReportJsonDataMock.mockReset();
    resetSearchIndexes();
  });

  it.each<SearchFindCase>([
    ["RequestWithDatesFormTest", ["tr-1"]],
    ["history-request-form", ["tr-1"]],
    ["Igor Martynov", ["tr-1"]],
    ["smoke", ["tr-1"]],
    ["browser:chromium", ["tr-1"]],
    ["region eu", ["tr-2"]],
    ["Product defects", ["tr-1"]],
    ["Date format assertion", ["tr-1"]],
    ["PAYMENTS-932", ["tr-2"]],
  ])("should find tests by %s", (query, expectedNodeIds) => {
    const searchIndex = createSearchIndex(documents);

    expect(searchNodeIds(searchIndex, query)).toEqual(new Set(expectedNodeIds));
  });

  it.each<SearchCase>([
    ["empty index", [], "anything", []],
    ["empty query", documents, "", []],
    ["blank query", documents, "   ", []],
    ["no-match query", documents, "does-not-exist", []],
    ["prefix query", documents, "subm", ["tr-2"]],
    ["fuzzy query", documents, "chekout", ["tr-2"]],
    ["case-insensitive query", documents, "igor martynov", ["tr-1"]],
  ])("should support %s", (_caseName, sourceDocuments, query, expectedNodeIds) => {
    const searchIndex = createSearchIndex(sourceDocuments);

    expect(searchNodeIds(searchIndex, query)).toEqual(new Set(expectedNodeIds));
  });

  it("should not retry missing environment index fetches on later calls", async () => {
    fetchReportJsonDataMock.mockRejectedValue(
      new ReportFetchError("missing search index", new Response(null, { status: 404, statusText: "Not Found" })),
    );

    await fetchEnvSearchIndexes(["missing-env"]);
    await fetchEnvSearchIndexes(["missing-env"]);

    expect(fetchReportJsonDataMock).toHaveBeenCalledOnce();
    expect(searchIndexesStore.value.data).toEqual({});
    expect(searchIndexesStore.value.error).toContain("missing search index");
  });

  it("should retry transient environment index fetch failures on later calls", async () => {
    fetchReportJsonDataMock.mockRejectedValueOnce(new Error("temporary search index error")).mockResolvedValueOnce([]);

    await fetchEnvSearchIndexes(["unstable-env"]);
    await fetchEnvSearchIndexes(["unstable-env"]);

    expect(fetchReportJsonDataMock).toHaveBeenCalledTimes(2);
    expect(searchIndexesStore.value.data?.["unstable-env"]).toBeDefined();
    expect(searchIndexesStore.value.error).toBeUndefined();
  });

  it("should preserve indexes loaded by overlapping fetches", async () => {
    let resolveFirstFetch: (documents: AwesomeSearchDocument[]) => void = () => {};
    let resolveSecondFetch: (documents: AwesomeSearchDocument[]) => void = () => {};
    const firstFetch = new Promise<AwesomeSearchDocument[]>((resolve) => {
      resolveFirstFetch = resolve;
    });
    const secondFetch = new Promise<AwesomeSearchDocument[]>((resolve) => {
      resolveSecondFetch = resolve;
    });

    fetchReportJsonDataMock.mockReturnValueOnce(firstFetch).mockReturnValueOnce(secondFetch);

    const firstIndexFetch = fetchEnvSearchIndexes(["env-a"]);
    const secondIndexFetch = fetchEnvSearchIndexes(["env-b"]);

    resolveSecondFetch([documents[1]]);
    await secondIndexFetch;
    resolveFirstFetch([documents[0]]);
    await firstIndexFetch;

    expect(searchIndexesStore.value.data?.["env-a"]).toBeDefined();
    expect(searchIndexesStore.value.data?.["env-b"]).toBeDefined();
  });
});
