import * as webCommons from "@allurereport/web-commons";
import { signal } from "@preact/signals";
import { cleanup, render, screen } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "@/components/Header";
import { CiInfo } from "@/components/Header/CiInfo";
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

vi.mock("@/components/Header/CiInfo", () => ({
  CiInfo: vi.fn().mockImplementation(() => <div data-testid="ci-info" />),
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
  it("should render ci info only when testResultId route parameter doesn't exists and ci report option is available", () => {
    mockRouteParams.value = {};
    vi.spyOn(webCommons, "getReportOptions").mockReturnValue({
      ci: fixtures.ci,
    });

    render(<Header />);

    expect(CiInfo).toHaveBeenCalled();
    expect(screen.getByTestId("ci-info")).toBeInTheDocument();
  });

  it("shouldn't render ci info when testResultId route parameter exists", () => {
    mockRouteParams.value = {
      testResultId: "1",
    };
    vi.spyOn(webCommons, "getReportOptions").mockReturnValue({
      ci: fixtures.ci,
    });

    render(<Header />);

    expect(CiInfo).not.toHaveBeenCalled();
    expect(screen.queryByTestId("ci-info")).not.toBeInTheDocument();
  });

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
