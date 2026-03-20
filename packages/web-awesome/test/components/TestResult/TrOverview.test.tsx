import { cleanup, render, screen } from "@testing-library/preact";
import type { AwesomeTestResult } from "types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TrOverview } from "@/components/TestResult/TrOverview";

vi.mock("@/components/TestResult/TestStepsEmpty", () => ({
  default: () => <div data-testid="test-steps-empty" />,
}));

vi.mock("@/components/TestResult/TrSteps", () => ({
  TrSteps: () => <div data-testid="tr-steps" />,
}));

vi.mock("@/components/TestResult/TrDescription", () => ({
  TrDescription: () => null,
}));

vi.mock("@/components/TestResult/TrLinks", () => ({
  TrLinks: () => null,
}));

vi.mock("@/components/TestResult/TrMetadata", () => ({
  TrMetadata: () => null,
}));

vi.mock("@/components/TestResult/TrParameters", () => ({
  TrParameters: () => null,
}));

vi.mock("@/components/TestResult/TrPwTraces", () => ({
  TrPwTraces: () => null,
}));

vi.mock("@/components/TestResult/TrSetup", () => ({
  TrSetup: () => null,
}));

vi.mock("@/components/TestResult/TrTeardown", () => ({
  TrTeardown: () => null,
}));

vi.mock("@/stores/locale", () => ({
  useI18n: () => ({
    t: (key: string) => (key === "error" ? "Error" : key),
  }),
}));

vi.mock("@/stores/testResult", () => ({
  currentTrId: { value: "current-test-result-id" },
}));

const makeTestResult = (overrides: Partial<AwesomeTestResult> = {}): AwesomeTestResult =>
  ({
    id: "test-result-id",
    name: "test",
    status: "failed",
    fullName: "test.fullName",
    flaky: false,
    muted: false,
    known: false,
    hidden: false,
    labels: [],
    groupedLabels: {},
    parameters: [],
    links: [],
    steps: [],
    error: undefined,
    descriptionHtml: undefined,
    testCase: undefined,
    environment: "default",
    setup: [],
    teardown: [],
    history: [],
    retries: [],
    breadcrumbs: [],
    retry: false,
    titlePath: [],
    attachments: [],
    ...overrides,
  }) as AwesomeTestResult;

describe("components > TestResult > TrOverview", () => {
  beforeEach(() => {
    cleanup();
  });

  it("should render TrSteps when the test has steps", () => {
    render(
      <TrOverview
        testResult={makeTestResult({
          steps: [{ type: "step", name: "step", status: "passed", parameters: [], steps: [] }],
        })}
      />,
    );

    expect(screen.getByTestId("tr-steps")).toBeInTheDocument();
    expect(screen.queryByTestId("test-steps-empty")).not.toBeInTheDocument();
  });

  it("should render TrSteps when the test has an error", () => {
    render(<TrOverview testResult={makeTestResult({ error: { message: "boom" } })} />);

    expect(screen.getByTestId("tr-steps")).toBeInTheDocument();
    expect(screen.queryByTestId("test-steps-empty")).not.toBeInTheDocument();
  });

  it("should render the empty state when there are no body items", () => {
    render(<TrOverview testResult={makeTestResult()} />);

    expect(screen.getByTestId("test-steps-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("tr-steps")).not.toBeInTheDocument();
  });
});
