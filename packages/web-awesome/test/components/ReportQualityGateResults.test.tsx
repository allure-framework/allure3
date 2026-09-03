import { signal } from "@preact/signals";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigateToTestResult = vi.fn();

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("ReportQualityGateResults");
  await label("coverage", "ui-components");
});

const setupQualityGateComponent = async (testResults: string[], extraResults: Record<string, unknown>[] = []) => {
  vi.resetModules();
  navigateToTestResult.mockClear();

  const currentEnvironment = signal("");
  const qualityGateStore = signal({
    loading: false,
    error: undefined,
    data: {
      default: [
        {
          success: false,
          expected: 0,
          actual: testResults.length,
          rule: "maxFailures",
          message: "Too many failures",
          testResults,
          testResultsTree:
            testResults.length > 0
              ? {
                  root: {
                    nodeId: "root",
                    leaves: testResults,
                  },
                  groupsById: {},
                  leavesById: {
                    "test-result-1": {
                      id: "test-result-1",
                      nodeId: "test-result-1",
                      name: "Failed checkout",
                      status: "failed",
                      groupOrder: 1,
                    },
                    "test-result-2": {
                      id: "test-result-2",
                      nodeId: "test-result-2",
                      name: "Failed refund",
                      status: "failed",
                      groupOrder: 2,
                    },
                  },
                }
              : undefined,
        },
        ...extraResults,
      ],
    },
  });

  vi.doMock("@allurereport/web-components", () => {
    const Tree = ({
      tree,
      name,
      navigateTo,
      toggleTree,
      isGroupOpened,
    }: {
      tree: any;
      name?: string;
      navigateTo: (id: string) => void;
      toggleTree: (id: string) => void;
      isGroupOpened?: (id: string) => boolean;
    }) => {
      const isOpened = isGroupOpened?.(tree.nodeId) ?? true;

      return (
        <div data-testid="related-test-results-tree">
          {name && (
            <button type="button" onClick={() => toggleTree(tree.nodeId)}>
              {name}
            </button>
          )}
          {isOpened &&
            tree.leaves.map((leaf: any) => (
              <button type="button" key={leaf.nodeId} onClick={() => navigateTo(leaf.nodeId)}>
                {leaf.name}
              </button>
            ))}
        </div>
      );
    };

    return {
      Loadable: ({
        source,
        renderData,
      }: {
        source: { value: { data: unknown } };
        renderData: (data: any) => unknown;
      }) => renderData(source.value.data),
      SvgIcon: ({ id, ...props }: { id?: string; [key: string]: unknown }) => <span data-icon={id} {...props} />,
      Text: ({
        tag: Tag = "span",
        children,
        size: _size,
        type: _type,
        bold: _bold,
        ...props
      }: {
        tag?: "p" | "span";
        children: unknown;
        size?: string;
        type?: string;
        bold?: boolean;
        [key: string]: unknown;
      }) => <Tag {...props}>{children}</Tag>,
      Tree,
      allureIcons: { solidXCircle: "solid-x-circle", solidCheckCircle: "solid-check-circle" },
    };
  });
  vi.doMock("@/components/MetadataButton", () => ({
    MetadataButton: () => <div />,
  }));
  vi.doMock("@/components/TestResult/TrError", () => ({
    TrError: ({ message, status, title }: { message: string; status?: string; title?: string }) => (
      <div data-testid="tr-error" data-status={status}>
        {title ? <span data-testid="tr-error-title">{title}</span> : null}
        {message}
      </div>
    ),
  }));
  vi.doMock("@/stores", () => ({
    useI18n: (namespace: string) => ({
      t: (key: string, options?: { count?: number }) =>
        namespace === "ui" && key === "relatedTestResults" ? `Related test results (${options?.count})` : key,
    }),
  }));
  vi.doMock("@/stores/env", () => ({
    currentEnvironment,
    environmentNameById: (environmentId: string) => environmentId,
  }));
  vi.doMock("@/stores/qualityGate", () => ({ qualityGateStore }));
  vi.doMock("@/stores/router", () => ({ navigateToTestResult }));
  vi.doMock("@/stores/testResult", () => ({ currentTrId: signal(undefined) }));
};

describe("components > Report quality gate results", () => {
  afterEach(() => {
    cleanup();
  });

  it("should render related test results tree and navigate to selected result", async () => {
    await setupQualityGateComponent(["test-result-1", "test-result-2"]);
    const { ReportQualityGateResults } = await import("@/components/ReportQualityGateResults");

    render(<ReportQualityGateResults />);

    expect(screen.getByRole("button", { name: "Related test results (2)" })).toBeInTheDocument();
    expect(screen.getByTestId("related-test-results-tree")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Failed checkout" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Related test results (2)" }));

    expect(screen.getByRole("button", { name: "Failed checkout" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Failed refund" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Failed checkout" }));

    expect(navigateToTestResult).toHaveBeenCalledWith({ testResultId: "test-result-1" });
  }, 15000);

  it("should render passed rules next to the failed ones", async () => {
    await setupQualityGateComponent(
      [],
      [
        {
          success: true,
          expected: 1,
          actual: 2,
          rule: "minTestsCount",
          message: "Enough tests have been run",
          testResults: [],
        },
      ],
    );
    const { ReportQualityGateResults } = await import("@/components/ReportQualityGateResults");

    render(<ReportQualityGateResults />);

    const results = screen.getAllByTestId("quality-gate-result");

    expect(results).toHaveLength(2);
    expect(results[0]).toHaveAttribute("data-success", "false");
    expect(results[1]).toHaveAttribute("data-success", "true");
    expect(screen.getByTestId("quality-gate-result-failed-icon")).toBeInTheDocument();
    expect(screen.getByTestId("quality-gate-result-passed-icon")).toBeInTheDocument();
    expect(screen.getByText("Enough tests have been run")).toBeInTheDocument();
    expect(screen.getByTestId("tr-error-title")).toHaveTextContent("success");
  }, 15000);

  it("should not render related test results section when ids are absent", async () => {
    await setupQualityGateComponent([]);
    const { ReportQualityGateResults } = await import("@/components/ReportQualityGateResults");

    render(<ReportQualityGateResults />);

    expect(screen.queryByTestId("quality-gate-result-test-results-title")).not.toBeInTheDocument();
  }, 15000);
});
