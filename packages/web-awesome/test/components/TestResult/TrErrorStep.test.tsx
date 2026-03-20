import { cleanup, fireEvent, render } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { matchMediaMock } = vi.hoisted(() => {
  const matchMediaMock = vi.fn().mockImplementation(() => ({
    matches: false,
    media: "",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  vi.stubGlobal("matchMedia", matchMediaMock);

  return { matchMediaMock };
});

import { TrErrorStep } from "@/components/TestResult/TrSteps/TrErrorStep";
import { collapsedTrees } from "@/stores/tree";

const mockTrError = vi.fn(({ message }: { message?: string }) => <div data-testid="error-content">{message}</div>);

vi.mock("@/components/TestResult/TrError", () => ({
  TrError: (props: { message?: string; showMessage?: boolean }) => mockTrError(props),
}));

describe("components > TestResult > TrErrorStep", () => {
  beforeEach(() => {
    cleanup();
    mockTrError.mockClear();
    matchMediaMock.mockClear();
    collapsedTrees.value = new Set();
  });

  it("should render the title and pass showMessage=false to TrError", () => {
    const view = render(
      <TrErrorStep
        stepIndex={2}
        item={{
          type: "error",
          id: "__test-error__:test-result-id",
          title: "boom",
          status: "failed",
          error: {
            message: "boom\nsecond line",
            trace: "error trace",
          },
        }}
      />,
    );

    expect(view.getByTestId("test-result-step-title")).toHaveTextContent("boom");
    expect(mockTrError.mock.calls[0]?.[0]).toMatchObject({
      message: "boom\nsecond line",
      trace: "error trace",
      showMessage: false,
      status: "failed",
    });
  });

  it("should be expanded by default when the error has trace or diff content", () => {
    const view = render(
      <TrErrorStep
        stepIndex={1}
        item={{
          type: "error",
          id: "expanded-test-id",
          title: "error with trace",
          status: "failed",
          error: {
            message: "error with trace",
            trace: "error trace",
          },
        }}
      />,
    );

    expect(view.getByTestId("test-result-step-content")).toBeInTheDocument();
  });

  it("should collapse the content when the header is clicked", () => {
    const view = render(
      <TrErrorStep
        stepIndex={1}
        item={{
          type: "error",
          id: "collapsible-test-id",
          title: "collapsible error",
          status: "broken",
          error: {
            message: "collapsible error",
            trace: "some trace",
          },
        }}
      />,
    );

    expect(view.getByTestId("error-content")).toBeInTheDocument();

    fireEvent.click(view.getByTestId("test-result-step-header"));

    expect(view.queryByTestId("error-content")).not.toBeInTheDocument();
  });

  it("shouldn't render an arrow or content when the error has only a message", () => {
    const view = render(
      <TrErrorStep
        stepIndex={1}
        item={{
          type: "error",
          id: "no-content-id",
          title: "only message",
          status: "failed",
          error: {
            message: "only message",
          },
        }}
      />,
    );

    expect(view.queryByTestId("test-result-step-arrow-button")).not.toBeInTheDocument();
    expect(view.queryByTestId("test-result-step-content")).not.toBeInTheDocument();
  });
});
