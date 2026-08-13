import { getReportOptions } from "@allurereport/web-commons";
import { cleanup, render, screen } from "@testing-library/preact";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { ReportMetadata } from "@/components/ReportMetadata";
import enLocale from "@/locales/en.json";

const reportStatsStoreMock = vi.hoisted(() => ({ value: { data: undefined as any } }));

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
  reportStatsStore: reportStatsStoreMock,
  statsByEnvStore: { value: { data: {} } },
  useI18n: (namespace: string) => ({
    t: (key: string) => {
      if (namespace === "testSummary") {
        return enLocale.testSummary[key as keyof typeof enLocale.testSummary] ?? key;
      }

      return key;
    },
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

vi.mock("@/stores/variables", () => ({
  fetchVariables: vi.fn(),
  variables: { value: { data: { default: {} } } },
}));

beforeEach(() => {
  vi.clearAllMocks();
  reportStatsStoreMock.value.data = undefined;
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

  it("should render known metadata with a localized label", () => {
    (getReportOptions as Mock).mockReturnValue({});
    reportStatsStoreMock.value.data = {
      total: 3,
      passed: 2,
      failed: 1,
      known: 1,
    };

    render(<ReportMetadata />);

    expect(screen.getByText("Known issue tests")).toBeInTheDocument();
    expect(screen.queryByText("known")).not.toBeInTheDocument();
  });
});
