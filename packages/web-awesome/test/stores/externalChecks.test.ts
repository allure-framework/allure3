import { ReportFetchError } from "@allurereport/web-commons";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const fetchReportJsonDataMock = vi.hoisted(() => vi.fn());

vi.mock("@allurereport/web-commons", async () => {
  const actual = await vi.importActual<typeof import("@allurereport/web-commons")>("@allurereport/web-commons");

  return {
    ...actual,
    fetchReportJsonData: fetchReportJsonDataMock,
  };
});

import { externalChecksStore, fetchExternalChecks } from "@/stores/externalChecks";

describe("external checks store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    externalChecksStore.value = { loading: true, error: undefined, data: undefined };
  });

  it("loads full external check results from the widget", async () => {
    const checks = {
      lint: { id: "lint", name: "ESLint", status: "passed", details: { command: "yarn lint" } },
    };
    fetchReportJsonDataMock.mockResolvedValueOnce(checks);

    await fetchExternalChecks();

    expect(fetchReportJsonDataMock).toHaveBeenCalledWith("widgets/check-results.json", { bustCache: true });
    expect(externalChecksStore.value).toEqual({ data: checks, error: undefined, loading: false });
  });

  it("falls back to the report summary when detailed check results are unavailable", async () => {
    fetchReportJsonDataMock
      .mockRejectedValueOnce(
        new ReportFetchError("missing checks", new Response(null, { status: 404, statusText: "Not Found" })),
      )
      .mockResolvedValueOnce({ checks: [{ id: "security", name: "Security", status: "failed" }] });

    await fetchExternalChecks();

    expect(fetchReportJsonDataMock).toHaveBeenNthCalledWith(2, "summary.json", { bustCache: true });
    expect(externalChecksStore.value).toEqual({
      data: { security: { id: "security", name: "Security", status: "failed" } },
      error: undefined,
      loading: false,
    });
  });
});
