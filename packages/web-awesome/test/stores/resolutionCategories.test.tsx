import { ReportFetchError } from "@allurereport/web-commons";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { ReportResolutionCategories } from "@/components/ReportResolutionCategories";
import { fetchResolutionCategoriesData, resolutionCategoriesStore } from "@/stores/resolutionCategories";

const fetchReportJsonDataMock = vi.hoisted(() => vi.fn());

vi.mock("@allurereport/web-commons", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@allurereport/web-commons")>()),
  fetchReportJsonData: fetchReportJsonDataMock,
}));

vi.mock("@/stores", () => ({
  useI18n: () => ({
    t: (key: string) => `translated:${key}`,
  }),
}));

beforeEach(() => {
  fetchReportJsonDataMock.mockReset();
  resolutionCategoriesStore.value = {
    loading: true,
    error: undefined,
    data: undefined,
  };
});

afterEach(() => {
  cleanup();
});

describe("stores > resolutionCategories", () => {
  it("should treat a missing widget as empty data and render the localized empty state", async () => {
    fetchReportJsonDataMock.mockRejectedValue(
      new ReportFetchError("Not found", new Response(null, { status: 404, statusText: "Not Found" })),
    );

    await fetchResolutionCategoriesData("missing-resolution-categories");

    expect(fetchReportJsonDataMock).toHaveBeenCalledWith(
      "widgets/missing-resolution-categories/resolution-categories.json",
    );
    expect(resolutionCategoriesStore.value).toEqual({
      data: { groups: [] },
      error: undefined,
      loading: false,
    });

    render(<ReportResolutionCategories />);

    expect(screen.getByText("translated:no-resolution-categories-results")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
