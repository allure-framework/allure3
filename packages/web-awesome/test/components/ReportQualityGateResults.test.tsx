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

const setupQualityGateComponent = async (
  testResults: string[],
  options: {
    resultsByEnv?: Record<string, unknown[]>;
    selectedEnvironment?: string;
    sharedEnvironment?: string | null;
  } = {},
) => {
  vi.resetModules();
  navigateToTestResult.mockClear();

  const { resultsByEnv, selectedEnvironment = "", sharedEnvironment = "default" } = options;
  const currentEnvironment = signal(selectedEnvironment);
  const sharedEnvironmentId = signal(sharedEnvironment);
  const qualityGateStore = signal({
    loading: false,
    error: undefined,
    data: resultsByEnv ?? {
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
      SvgIcon: () => <span />,
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
      allureIcons: { solidXCircle: "solid-x-circle" },
    };
  });
  vi.doMock("@/components/MetadataButton", () => ({
    MetadataButton: ({ title, counter }: { title?: string; counter?: number }) => (
      <div>{counter === undefined ? title : `${title} (${counter})`}</div>
    ),
  }));
  vi.doMock("@/components/TestResult/TrError", () => ({
    TrError: ({ message }: { message: string }) => <div>{message}</div>,
  }));
  vi.doMock("@/stores", () => ({
    useI18n: (namespace: string) => ({
      t: (key: string, options?: { count?: number }) =>
        namespace === "ui" && key === "relatedTestResults" ? `Related test results (${options?.count})` : key,
    }),
  }));
  vi.doMock("@/stores/env", () => ({
    currentEnvironment,
    sharedEnvironmentId,
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

  it("should not render related test results section when ids are absent", async () => {
    await setupQualityGateComponent([]);
    const { ReportQualityGateResults } = await import("@/components/ReportQualityGateResults");

    render(<ReportQualityGateResults />);

    expect(screen.queryByTestId("quality-gate-result-test-results-title")).not.toBeInTheDocument();
  }, 15000);

  it("should keep results without an environment visible while a single environment is selected", async () => {
    await setupQualityGateComponent([], {
      resultsByEnv: {
        default: [{ rule: "maxFailures", message: "Shared failure", testResults: [] }],
        qa_env: [{ rule: "minTestsCount", message: "QA failure", testResults: [] }],
        prod_env: [{ rule: "maxRetriesCount", message: "Prod failure", testResults: [] }],
      },
      selectedEnvironment: "qa_env",
    });
    const { ReportQualityGateResults } = await import("@/components/ReportQualityGateResults");

    render(<ReportQualityGateResults />);

    expect(screen.getByText("QA failure")).toBeInTheDocument();
    expect(screen.getByText("Shared failure")).toBeInTheDocument();
    expect(screen.queryByText("Prod failure")).not.toBeInTheDocument();
    expect(screen.getByText('environment: "qa_env" (1)')).toBeInTheDocument();
    expect(screen.getByText('environment: "default" (1)')).toBeInTheDocument();
  }, 15000);

  it("should label the shared bucket when the selected environment has no results of its own", async () => {
    await setupQualityGateComponent([], {
      resultsByEnv: {
        default: [{ rule: "maxFailures", message: "Shared failure", testResults: [] }],
        prod_env: [{ rule: "maxRetriesCount", message: "Prod failure", testResults: [] }],
      },
      selectedEnvironment: "qa_env",
    });
    const { ReportQualityGateResults } = await import("@/components/ReportQualityGateResults");

    render(<ReportQualityGateResults />);

    expect(screen.getByText("Shared failure")).toBeInTheDocument();
    expect(screen.getByText('environment: "default" (1)')).toBeInTheDocument();
    expect(screen.queryByText("Prod failure")).not.toBeInTheDocument();
  }, 15000);

  it("should keep the default bucket environment specific when the report declares it as an environment", async () => {
    await setupQualityGateComponent([], {
      resultsByEnv: {
        default: [{ rule: "maxFailures", message: "Default failure", testResults: [] }],
        qa_env: [{ rule: "minTestsCount", message: "QA failure", testResults: [] }],
      },
      selectedEnvironment: "qa_env",
      sharedEnvironment: null,
    });
    const { ReportQualityGateResults } = await import("@/components/ReportQualityGateResults");

    render(<ReportQualityGateResults />);

    expect(screen.getByText("QA failure")).toBeInTheDocument();
    expect(screen.queryByText("Default failure")).not.toBeInTheDocument();
  }, 15000);

  it("should show the empty state when neither the selected nor the shared bucket has results", async () => {
    await setupQualityGateComponent([], {
      resultsByEnv: {
        prod_env: [{ rule: "maxRetriesCount", message: "Prod failure", testResults: [] }],
      },
      selectedEnvironment: "qa_env",
    });
    const { ReportQualityGateResults } = await import("@/components/ReportQualityGateResults");

    render(<ReportQualityGateResults />);

    expect(screen.getByText("no-quality-gate-results")).toBeInTheDocument();
    expect(screen.queryByText("Prod failure")).not.toBeInTheDocument();
  }, 15000);
});
