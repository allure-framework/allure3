import { act, screen, waitFor } from "@testing-library/preact";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("App");
  await label("coverage", "ui-components");
});

const {
  ensureReportDataReadyMock,
  fetchReportStatsMock,
  fetchEnvStatsMock,
  getLocaleMock,
  fetchPieChartDataMock,
  fetchCategoriesDataMock,
  fetchEnvironmentsMock,
  fetchEnvInfoMock,
  fetchGlobalsMock,
  fetchQualityGateResultsMock,
  fetchEnvTreesDataMock,
  fetchTestResultMock,
  fetchTestResultNavMock,
  fetchTreeFiltersDataMock,
  migrateFilterParamMock,
} = vi.hoisted(() => ({
  ensureReportDataReadyMock: vi.fn(),
  fetchReportStatsMock: vi.fn(),
  fetchEnvStatsMock: vi.fn(),
  getLocaleMock: vi.fn(),
  fetchPieChartDataMock: vi.fn(),
  fetchCategoriesDataMock: vi.fn(),
  fetchEnvironmentsMock: vi.fn(),
  fetchEnvInfoMock: vi.fn(),
  fetchGlobalsMock: vi.fn(),
  fetchQualityGateResultsMock: vi.fn(),
  fetchEnvTreesDataMock: vi.fn(),
  fetchTestResultMock: vi.fn(),
  fetchTestResultNavMock: vi.fn(),
  fetchTreeFiltersDataMock: vi.fn(),
  migrateFilterParamMock: vi.fn(),
}));

// Mocks for all data fetching the App triggers during prefetch and on environment changes.
vi.mock("@allurereport/web-commons", async () => {
  const actual = await vi.importActual<typeof import("@allurereport/web-commons")>("@allurereport/web-commons");

  return {
    ...actual,
    ensureReportDataReady: ensureReportDataReadyMock,
  };
});

vi.mock("@/stores", () => ({
  fetchReportStats: fetchReportStatsMock,
  fetchEnvStats: fetchEnvStatsMock,
  getLocale: getLocaleMock,
  waitForI18next: Promise.resolve(),
}));

vi.mock("@/stores/chart", () => ({ fetchPieChartData: fetchPieChartDataMock }));
vi.mock("@/stores/categories", () => ({ fetchCategoriesData: fetchCategoriesDataMock }));
vi.mock("@/stores/env", async () => {
  const actual = await vi.importActual<typeof import("@/stores/env")>("@/stores/env");

  return {
    ...actual,
    fetchEnvironments: fetchEnvironmentsMock,
  };
});
vi.mock("@/stores/envInfo", () => ({ fetchEnvInfo: fetchEnvInfoMock }));
vi.mock("@/stores/globals", () => ({ fetchGlobals: fetchGlobalsMock }));
vi.mock("@/stores/qualityGate", () => ({ fetchQualityGateResults: fetchQualityGateResultsMock }));
vi.mock("@/stores/tree", () => ({ fetchEnvTreesData: fetchEnvTreesDataMock }));
vi.mock("@/stores/testResults", () => ({
  fetchTestResult: fetchTestResultMock,
  fetchTestResultNav: fetchTestResultNavMock,
}));
vi.mock("@/stores/treeFilters/actions", () => ({ fetchTreeFiltersData: fetchTreeFiltersDataMock }));
vi.mock("@/stores/treeFilters/utils", () => ({ migrateFilterParam: migrateFilterParamMock }));

// Stubs for the UI rendered by the App — only the loader and the data fetching effects matter here.
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
vi.mock("@/components/Header", () => ({ Header: () => null }));
vi.mock("@/components/HotkeysProvider", () => ({ HotkeysProvider: () => null }));
vi.mock("@/components/KeyboardShortcuts", () => ({ KeyboardShortcuts: () => null }));
vi.mock("@/components/Modal", () => ({ ModalComponent: () => null }));
vi.mock("@/components/SectionSwitcher", () => ({ SectionSwitcher: () => null }));

import { currentEnvironment, environmentsStore } from "@/stores/env";

const selectEnvironment = async (envId: string) => {
  await act(async () => {
    currentEnvironment.value = envId;
  });
};

describe("App", () => {
  // index.tsx renders the app on import, so the module is imported once and the
  // environment switching scenarios run against the same mounted app.
  beforeAll(async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation(() => ({
        matches: false,
        media: "",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    document.body.innerHTML = '<div id="app"></div>';

    currentEnvironment.value = "";
    environmentsStore.value = {
      loading: false,
      error: undefined,
      data: [
        { id: "env-1", name: "env-1" },
        { id: "env-2", name: "env-2" },
      ],
    };

    await import("@/index");

    await waitFor(() => {
      expect(screen.queryByTestId("loader")).not.toBeInTheDocument();
    });
  });

  it("should fetch env-scoped data when an environment is selected", async () => {
    await selectEnvironment("");
    vi.clearAllMocks();

    await selectEnvironment("env-1");

    expect(fetchPieChartDataMock).toHaveBeenCalledTimes(1);
    expect(fetchPieChartDataMock).toHaveBeenCalledWith("env-1");
    expect(fetchCategoriesDataMock).toHaveBeenCalledTimes(1);
    expect(fetchCategoriesDataMock).toHaveBeenCalledWith("env-1");
    expect(fetchEnvTreesDataMock).toHaveBeenCalledTimes(1);
    expect(fetchEnvTreesDataMock).toHaveBeenCalledWith(["env-1"]);
    expect(fetchEnvStatsMock).toHaveBeenCalledTimes(1);
    expect(fetchEnvStatsMock).toHaveBeenCalledWith(["env-1"]);
  });

  it("should refetch pie chart and categories data when switching back to all environments", async () => {
    await selectEnvironment("env-2");
    vi.clearAllMocks();

    await selectEnvironment("");

    expect(fetchPieChartDataMock).toHaveBeenCalledTimes(1);
    expect(fetchPieChartDataMock).toHaveBeenCalledWith("");
    expect(fetchCategoriesDataMock).toHaveBeenCalledTimes(1);
    expect(fetchCategoriesDataMock).toHaveBeenCalledWith("");
    expect(fetchEnvTreesDataMock).not.toHaveBeenCalled();
    expect(fetchEnvStatsMock).not.toHaveBeenCalled();
  });
});
