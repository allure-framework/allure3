import { getReportOptions } from "@allurereport/web-commons";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { ReportMetadata } from "@/components/ReportMetadata";
import { MetadataSummary } from "@/components/ReportMetadata/MetadataSummary";

const {
  setTreeFlakyMock,
  setTreeRetryMock,
  setTreeStatusMock,
  setTreeTransitionsMock,
  treeFlakyMock,
  treeRetryMock,
  treeStatusMock,
  treeTransitionsMock,
} = vi.hoisted(() => ({
  setTreeFlakyMock: vi.fn(),
  setTreeRetryMock: vi.fn(),
  setTreeStatusMock: vi.fn(),
  setTreeTransitionsMock: vi.fn(),
  treeFlakyMock: { value: false },
  treeRetryMock: { value: false },
  treeStatusMock: { value: "total" },
  treeTransitionsMock: { value: [] as string[] },
}));

vi.mock("@allurereport/web-commons", async (importOriginal) => ({
  ...(await importOriginal()),
  getReportOptions: vi.fn(),
}));

vi.mock("@allurereport/web-components", () => {
  const Menu = Object.assign(
    (props: { children: unknown; menuTrigger: (props: { onClick: () => void }) => unknown }) => (
      <>
        {props.menuTrigger({ onClick: vi.fn() })}
        {props.children}
      </>
    ),
    {
      Section: (props: { children: unknown }) => <>{props.children}</>,
    },
  );

  return {
    ArrowButton: () => <span />,
    Button: (props: { text?: string; onClick?: () => void }) => <button onClick={props.onClick}>{props.text}</button>,
    ButtonLink: (props: { href: string; text?: string }) => <a href={props.href}>{props.text}</a>,
    Counter: (props: { count: number }) => <span>{props.count}</span>,
    Loadable: (props: {
      source: { value?: { data?: unknown } };
      transformData?: (data: unknown) => unknown;
      renderData: (data: unknown) => unknown;
    }) =>
      props.renderData(props.transformData ? props.transformData(props.source.value?.data) : props.source.value?.data),
    Menu,
    SvgIcon: () => <span />,
    Text: (props: { children: unknown }) => <span>{props.children}</span>,
    TooltipWrapper: (props: { children: unknown }) => props.children,
    allureIcons: {
      lineGeneralCopy3: "copy",
      lineGeneralLinkExternal: "external",
    },
    useElementTruncation: () => ({ ref: { current: null }, isTruncated: false }),
  };
});

vi.mock("@/stores", () => ({
  reportStatsStore: { value: { data: undefined } },
  statsByEnvStore: { value: { data: {} } },
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/stores/env", () => ({
  currentEnvironment: { value: undefined },
}));

vi.mock("@/stores/envInfo", () => ({
  envInfoStore: { value: { data: [] } },
}));

vi.mock("@/stores/tree", () => ({
  collapsedTrees: { value: new Set() },
  toggleTree: vi.fn(),
}));

vi.mock("@/stores/treeFilters/store", () => ({
  setTreeFlaky: setTreeFlakyMock,
  setTreeRetry: setTreeRetryMock,
  setTreeStatus: setTreeStatusMock,
  setTreeTransitions: setTreeTransitionsMock,
  treeFlaky: treeFlakyMock,
  treeRetry: treeRetryMock,
  treeStatus: treeStatusMock,
  treeTransitions: treeTransitionsMock,
}));

vi.mock("@/stores/variables", () => ({
  fetchVariables: vi.fn(),
  variables: { value: { data: { default: {} } } },
}));

beforeEach(() => {
  vi.clearAllMocks();
  treeFlakyMock.value = false;
  treeRetryMock.value = false;
  treeStatusMock.value = "total";
  treeTransitionsMock.value = [];
  cleanup();
});

describe("components > ReportMetadata", () => {
  it("should render executor metadata as a clickable build link", () => {
    (getReportOptions as Mock).mockReturnValue({
      executor: {
        name: "TeamCity",
        buildName: "Wrike #123",
        url: "https://teamcity.example",
        reportUrl: "https://teamcity.example/report/123",
        buildUrl: "https://teamcity.example/build/123",
      },
    });

    render(<ReportMetadata />);

    expect(screen.getByText("executor")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "TeamCity · Wrike #123" })).toHaveAttribute(
      "href",
      "https://teamcity.example/build/123",
    );
  });

  it("should fall back to report url when executor build url is missing", () => {
    (getReportOptions as Mock).mockReturnValue({
      executor: {
        name: "TeamCity",
        buildName: "Wrike #123",
        reportUrl: "https://teamcity.example/report/123",
      },
    });

    render(<ReportMetadata />);

    expect(screen.getByRole("link", { name: "TeamCity · Wrike #123" })).toHaveAttribute(
      "href",
      "https://teamcity.example/report/123",
    );
  });

  it("should render executor metadata as plain text when url is unsafe", () => {
    (getReportOptions as Mock).mockReturnValue({
      executor: {
        name: "TeamCity",
        buildName: "Wrike #123",
        buildUrl: "javascript:alert(1)",
      },
    });

    render(<ReportMetadata />);

    expect(screen.queryByRole("link", { name: "TeamCity · Wrike #123" })).not.toBeInTheDocument();
    expect(screen.getByTestId("metadata-item")).toHaveTextContent("TeamCity · Wrike #123");
  });

  it("should apply tree filters from summary metadata clicks", () => {
    treeTransitionsMock.value = ["fixed"];

    render(
      <MetadataSummary
        stats={{
          total: 12,
          passed: 9,
          skipped: 1,
          unknown: 2,
          new: 3,
          retries: 4,
          flaky: 5,
        }}
      />,
    );

    fireEvent.click(screen.getByTestId("metadata-item-total"));
    fireEvent.click(screen.getByTestId("metadata-item-passed"));
    fireEvent.click(screen.getByTestId("metadata-item-new"));
    fireEvent.click(screen.getByTestId("metadata-item-retries"));
    fireEvent.click(screen.getByTestId("metadata-item-flaky"));

    expect(setTreeStatusMock).toHaveBeenCalledWith("total");
    expect(setTreeTransitionsMock).toHaveBeenCalledWith([]);
    expect(setTreeRetryMock).toHaveBeenCalledWith(false);
    expect(setTreeFlakyMock).toHaveBeenCalledWith(false);
    expect(setTreeStatusMock).toHaveBeenCalledWith("passed");
    expect(setTreeTransitionsMock).toHaveBeenCalledWith(["fixed", "new"]);
    expect(setTreeRetryMock).toHaveBeenCalledWith(true);
    expect(setTreeFlakyMock).toHaveBeenCalledWith(true);
  });

  it("should clear summary metadata filters when total is clicked", () => {
    treeFlakyMock.value = true;
    treeRetryMock.value = true;
    treeStatusMock.value = "failed";
    treeTransitionsMock.value = ["new"];

    render(
      <MetadataSummary
        stats={{
          total: 12,
          passed: 9,
          failed: 1,
          skipped: 1,
          unknown: 1,
          new: 3,
          retries: 4,
          flaky: 5,
        }}
      />,
    );

    fireEvent.click(screen.getByTestId("metadata-item-total"));

    expect(setTreeStatusMock).toHaveBeenCalledWith("total");
    expect(setTreeTransitionsMock).toHaveBeenCalledWith([]);
    expect(setTreeRetryMock).toHaveBeenCalledWith(false);
    expect(setTreeFlakyMock).toHaveBeenCalledWith(false);
  });

  it("should toggle active summary metadata filters off", () => {
    treeFlakyMock.value = true;
    treeRetryMock.value = true;
    treeStatusMock.value = "passed";
    treeTransitionsMock.value = ["fixed", "new"];

    render(
      <MetadataSummary
        stats={{
          total: 12,
          passed: 9,
          skipped: 1,
          unknown: 2,
          new: 3,
          retries: 4,
          flaky: 5,
        }}
      />,
    );

    fireEvent.click(screen.getByTestId("metadata-item-passed"));
    fireEvent.click(screen.getByTestId("metadata-item-new"));
    fireEvent.click(screen.getByTestId("metadata-item-retries"));
    fireEvent.click(screen.getByTestId("metadata-item-flaky"));

    expect(setTreeStatusMock).toHaveBeenCalledWith("total");
    expect(setTreeTransitionsMock).toHaveBeenCalledWith(["fixed"]);
    expect(setTreeRetryMock).toHaveBeenCalledWith(false);
    expect(setTreeFlakyMock).toHaveBeenCalledWith(false);
  });

  it("should expose active summary metadata filters to assistive technology", () => {
    treeFlakyMock.value = true;
    treeRetryMock.value = true;
    treeStatusMock.value = "total";
    treeTransitionsMock.value = ["new"];

    render(
      <MetadataSummary
        stats={{
          total: 12,
          passed: 9,
          skipped: 1,
          unknown: 2,
          new: 3,
          retries: 4,
          flaky: 5,
        }}
      />,
    );

    expect(screen.getByTestId("metadata-item-total")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("metadata-item-passed")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("metadata-item-new")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("metadata-item-retries")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("metadata-item-flaky")).toHaveAttribute("aria-pressed", "true");
  });
});
