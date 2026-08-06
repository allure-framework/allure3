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

import { fetchKnownIssuesData, knownIssuesStore } from "../../src/stores/knownIssues.js";

describe("stores > knownIssues", () => {
  beforeEach(() => {
    fetchReportJsonDataMock.mockReset();
    knownIssuesStore.value = {
      loading: true,
      error: undefined,
      data: undefined,
    };
  });

  it("should fetch root known issues data from the generated widget", async () => {
    const knownIssues = {
      issues: [{ id: "issue-1", reason: "BUG-1" }],
      testResultsByIssueId: { "issue-1": [] },
    };

    fetchReportJsonDataMock.mockResolvedValue(knownIssues);

    await fetchKnownIssuesData();

    expect(fetchReportJsonDataMock).toHaveBeenCalledWith("widgets/known-issues.json");
    expect(knownIssuesStore.value).toEqual({
      data: knownIssues,
      error: undefined,
      loading: false,
    });
  });

  it("should fall back to empty known issues for reports without the generated widget", async () => {
    fetchReportJsonDataMock.mockRejectedValue(
      new ReportFetchError("missing known issues", new Response(null, { status: 404, statusText: "Not Found" })),
    );

    await fetchKnownIssuesData("missing-env");

    expect(fetchReportJsonDataMock).toHaveBeenCalledWith("widgets/missing-env/known-issues.json");
    expect(knownIssuesStore.value).toEqual({
      data: {
        issues: [],
        testResultsByIssueId: {},
      },
      error: undefined,
      loading: false,
    });
  });

  it("should expose unexpected known issues fetch errors", async () => {
    fetchReportJsonDataMock.mockRejectedValue(new Error("malformed known issues"));

    await fetchKnownIssuesData("broken-env");

    expect(knownIssuesStore.value).toEqual({
      data: undefined,
      error: "malformed known issues",
      loading: false,
    });
  });
});
