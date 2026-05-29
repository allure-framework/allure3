import { signal } from "@preact/signals";
import { cleanup, render, screen } from "@testing-library/preact";
import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("Timeline");
  await label("coverage", "ui-components");
});

type TimelineTestResult = {
  id: string;
  name: string;
  status: "passed" | "failed";
  isRetry: boolean;
  environment: string;
  environmentName?: string;
  host: string;
  thread: string;
  start: number;
  duration: number;
};

const setup = async (timelineData: TimelineTestResult[]) => {
  vi.resetModules();

  const currentEnvironment = signal("qa_a");
  const timelineStore = signal({
    loading: false,
    error: undefined,
    data: timelineData,
  });
  const fetchTimelineData = vi.fn();

  vi.doMock("@allurereport/web-components", () => ({
    Timeline: ({ data, dataId }: { data: TimelineTestResult[]; dataId: string }) => (
      <div data-testid={`timeline-${dataId}`}>{data.map(({ id }) => id).join(",")}</div>
    ),
    Grid: ({ children }: { children: unknown }) => <div>{children as any}</div>,
    GridItem: ({ children }: { children: unknown }) => <div>{children as any}</div>,
    Loadable: ({ renderData }: { renderData: () => any }) => renderData(),
    PageLoader: () => <div>loading</div>,
    Widget: ({ children }: { children: unknown }) => <div>{children as any}</div>,
  }));
  vi.doMock("@/stores", () => ({
    useI18n: () => ({
      t: (key: string, params?: Record<string, string>) => (key === "host" ? `host:${params?.host}` : key),
    }),
  }));
  vi.doMock("@/stores/env", () => ({
    currentEnvironment,
    environmentNameById: (environmentId: string) => {
      if (environmentId === "qa_a" || environmentId === "qa_b") {
        return "QA";
      }

      return environmentId;
    },
  }));
  vi.doMock("@/stores/timeline", () => ({
    fetchTimelineData,
    timelineStore,
  }));

  const { Timeline } = await import("@/components/Timeline");

  render(<Timeline />);
};

describe("components > Timeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("should keep environments with colliding display names separated by environment id", async () => {
    await setup([
      {
        id: "tr-qa-a",
        name: "qa a test",
        status: "passed",
        isRetry: false,
        environment: "qa_a",
        environmentName: "QA",
        host: "shared-host",
        thread: "thread-1",
        start: 1,
        duration: 10,
      },
      {
        id: "tr-qa-b",
        name: "qa b test",
        status: "failed",
        isRetry: false,
        environment: "qa_b",
        environmentName: "QA",
        host: "shared-host",
        thread: "thread-1",
        start: 2,
        duration: 20,
      },
    ]);

    expect(screen.getByTestId("timeline-shared-host")).toHaveTextContent("tr-qa-a");
    expect(screen.getByTestId("timeline-shared-host")).not.toHaveTextContent("tr-qa-b");
  });
});
