import { getReportOptions } from "@allurereport/web-commons";
import { computed, signal } from "@preact/signals";
import { cleanup, render, screen } from "@testing-library/preact";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "@/components/Header";
import { CiInfo } from "@/components/Header/CiInfo";
import { availableSections } from "@/stores/sections";

const fixtures = {
  ci: {
    type: "github",
  },
};

const route = signal({});

vi.mock("@allurereport/web-commons", () => ({
  getReportOptions: vi.fn().mockReturnValue({}),
}));
vi.mock("@/stores/router", async () => {
  const testResultRoute = computed(() => {
    const routeValue = route.value as { params?: { testResultId?: string; tab?: string } };
    const hasTestResultId = routeValue.params?.testResultId !== undefined;
    return {
      matches: hasTestResultId,
      params: routeValue.params || {},
    };
  });

  return {
    route,
    testResultRoute,
  };
});
vi.mock("@/stores/sections", async () => {
  const { signal } = await import("@preact/signals");

  return {
    availableSections: signal([]),
  };
});
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
  // CiInfo: vi.fn().mockReturnValue(<div data-testid="ci-info"></div>),
  CiInfo: vi.fn().mockImplementation(() => <div data-testid="ci-info" />),
}));
vi.mock("@/stores/testResult", async () => {
  const { computed } = await import("@preact/signals");
  const { testResultRoute } = await import("@/stores/router");

  return {
    currentTrId: computed(() => testResultRoute.value.params.testResultId),
  };
});
vi.mock("@/stores/testResults", async () => {
  const { signal } = await import("@preact/signals");

  return {
    testResultStore: signal({
      loading: false,
      error: undefined,
      data: undefined,
    }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  route.value = {};
  availableSections.value = [];
});

describe("components > Header", () => {
  it("should render sections picker when there are sections available", () => {
    availableSections.value = ["section1", "section2"];

    render(<Header />);

    expect(screen.getByTestId("section-picker")).toBeInTheDocument();
  });

  it("shouldn't render sections picker when there are no sections available", () => {
    render(<Header />);

    expect(screen.queryByTestId("section-picker")).not.toBeInTheDocument();
  });

  it("should render ci info only when testResultId route parameter doesn't exists and ci report option is available", () => {
    route.value = {
      params: {},
    };
    (getReportOptions as Mock).mockReturnValue({
      ci: fixtures.ci,
    });

    render(<Header />);

    expect(CiInfo).toHaveBeenCalled();
    expect(screen.getByTestId("ci-info")).toBeInTheDocument();
  });

  it("shouldn't render ci info when testResultId route parameter exists", () => {
    route.value = {
      params: {
        testResultId: "1",
      },
    };
    (getReportOptions as Mock).mockReturnValue({
      ci: fixtures.ci,
    });

    render(<Header />);

    expect(CiInfo).not.toHaveBeenCalled();
    expect(screen.queryByTestId("ci-info")).not.toBeInTheDocument();
  });

  it("should render breadcrumbs when testResultId route parameter exists", () => {
    route.value = {
      params: {
        testResultId: "1",
      },
    };
    (getReportOptions as Mock).mockReturnValue({
      ci: fixtures.ci,
    });

    render(<Header />);

    expect(screen.getByTestId("breadcrumbs")).toBeInTheDocument();
  });

  it("shouldn't render breadcrumbs when testResultId route parameter doesn't exists", () => {
    route.value = {
      params: {},
    };

    render(<Header />);

    expect(screen.queryByTestId("breadcrumbs")).not.toBeInTheDocument();
  });
});
