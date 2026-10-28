import * as webCommons from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import { cleanup, render, screen } from "@testing-library/preact";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("Header");
  await label("coverage", "ui-components");
});

import { Header } from "@/components/Header";
import type * as routerModule from "@/stores/router";
import { testResultStore } from "@/stores/testResults";

const fixtures = {
  ci: {
    type: "github",
  },
};

// Create a controllable route signal
const mockRouteParams = signal<{ testResultId?: string; tab?: string }>({});

// Mock UI components to simplify tests
vi.mock("@/components/HeaderControls", () => ({
  HeaderControls: () => <div data-testid="header-controls" />,
}));

vi.mock("@/components/SectionPicker", () => ({
  SectionPicker: () => <div data-testid="section-picker" />,
}));

vi.mock("@/components/TestResult/TrHeader/TrBreadcrumbs", () => ({
  TrBreadcrumbs: () => <div data-testid="breadcrumbs" />,
}));

// Mock router module with controllable testResultRoute
vi.mock("@/stores/router", async (importOriginal) => {
  const actual = await importOriginal<typeof routerModule>();
  const { computed: computedFn } = await import("@preact/signals");

  return {
    ...actual,
    testResultRoute: computedFn(() => {
      const params = mockRouteParams.value;
      const hasTestResultId = params.testResultId !== undefined;
      return {
        matches: hasTestResultId,
        params: params || {},
      };
    }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  mockRouteParams.value = {};
  testResultStore.value = {
    loading: false,
    error: undefined,
    data: undefined,
  };
  vi.spyOn(webCommons, "getReportOptions").mockReturnValue({});
});

describe("components > Header", () => {
  it.each([{}, { testResultId: "1" }])(
    "should keep Git metadata out of the navigation header on route %j",
    (params) => {
      mockRouteParams.value = params;
      vi.spyOn(webCommons, "getReportOptions").mockReturnValue({ ci: fixtures.ci, git: { branch: "main" } });

      render(<Header />);

      expect(screen.queryByTestId("git-info")).not.toBeInTheDocument();
      expect(screen.getByTestId("section-picker")).toBeInTheDocument();
      expect(screen.getByTestId("header-controls")).toBeInTheDocument();
    },
  );

  it("should render breadcrumbs when testResultId route parameter exists", () => {
    mockRouteParams.value = {
      testResultId: "1",
    };
    vi.spyOn(webCommons, "getReportOptions").mockReturnValue({
      ci: fixtures.ci,
    });

    render(<Header />);

    expect(screen.getByTestId("breadcrumbs")).toBeInTheDocument();
  });

  it("shouldn't render breadcrumbs when testResultId route parameter doesn't exists", () => {
    mockRouteParams.value = {};

    render(<Header />);

    expect(screen.queryByTestId("breadcrumbs")).not.toBeInTheDocument();
  });
});
