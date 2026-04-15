import { signal } from "@preact/signals";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

const environmentNames: Record<string, string> = {
  prod_env: "Prod",
  qa_env: "QA",
};

const setupGlobalsComponent = async (data: Record<string, unknown>) => {
  vi.resetModules();

  const currentEnvironment = signal("");
  const globalsStore = signal({
    loading: false,
    error: undefined,
    data,
  });

  vi.doMock("@allurereport/web-components", () => ({
    Loadable: ({ source, renderData }: { source: { value: { data: unknown } }; renderData: (data: any) => unknown }) =>
      renderData(source.value.data),
  }));
  vi.doMock("@/stores", () => ({
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }));
  vi.doMock("@/stores/env", () => ({
    currentEnvironment,
    environmentNameById: (environmentId: string) => environmentNames[environmentId] ?? environmentId,
  }));
  vi.doMock("@/stores/globals", () => ({
    globalsStore,
  }));
  vi.doMock("@/components/MetadataButton", () => ({
    MetadataButton: ({ title, counter }: { title?: string; counter?: number }) => (
      <div>{counter === undefined ? title : `${title} (${counter})`}</div>
    ),
  }));
  vi.doMock("@/components/TestResult/TrSteps/TrAttachment", () => ({
    TrAttachment: ({ item }: { item: { link: { name?: string; originalFileName: string } } }) => (
      <span>{item.link.name ?? item.link.originalFileName}</span>
    ),
  }));
  vi.doMock("@/components/TestResult/TrError", () => ({
    TrError: ({ message }: { message: string }) => <div>{message}</div>,
  }));
};

describe("components > Report globals", () => {
  afterEach(() => {
    cleanup();
  });

  it("should render grouped global attachments using quality-gate style environment sections", async () => {
    await setupGlobalsComponent({
      attachments: [
        {
          id: "default",
          name: "default.log",
          originalFileName: "default.log",
          ext: ".log",
          used: true,
          missed: false,
          environment: "default",
        },
        {
          id: "qa",
          name: "qa.log",
          originalFileName: "qa.log",
          ext: ".log",
          used: true,
          missed: false,
          environment: "QA",
        },
        {
          id: "prod",
          name: "prod.log",
          originalFileName: "prod.log",
          ext: ".log",
          used: true,
          missed: false,
          environment: "Prod",
        },
      ],
      attachmentsByEnv: {
        default: [
          {
            id: "default",
            name: "default.log",
            originalFileName: "default.log",
            ext: ".log",
            used: true,
            missed: false,
            environment: "default",
          },
        ],
        qa_env: [
          {
            id: "qa",
            name: "qa.log",
            originalFileName: "qa.log",
            ext: ".log",
            used: true,
            missed: false,
            environment: "QA",
          },
        ],
        prod_env: [
          {
            id: "prod",
            name: "prod.log",
            originalFileName: "prod.log",
            ext: ".log",
            used: true,
            missed: false,
            environment: "Prod",
          },
        ],
      },
    });

    const { ReportGlobalAttachments } = await import("@/components/ReportGlobalAttachments");

    render(<ReportGlobalAttachments />);

    expect(screen.queryByText(/all/i)).not.toBeInTheDocument();
    expect(screen.getByText("default.log")).toBeInTheDocument();
    expect(screen.getByText('environment: "default" (1)')).toBeInTheDocument();
    expect(screen.getByText('environment: "QA" (1)')).toBeInTheDocument();
    expect(screen.getByText('environment: "Prod" (1)')).toBeInTheDocument();
  }, 15000);

  it("should render grouped global errors using quality-gate style environment sections", async () => {
    await setupGlobalsComponent({
      errors: [
        { message: "Default failure", environment: "default" },
        { message: "QA failure", environment: "QA" },
        { message: "Prod failure", environment: "Prod" },
      ],
      errorsByEnv: {
        default: [{ message: "Default failure", environment: "default" }],
        qa_env: [{ message: "QA failure", environment: "QA" }],
        prod_env: [{ message: "Prod failure", environment: "Prod" }],
      },
    });

    const { ReportGlobalErrors } = await import("@/components/ReportGlobalErrors");

    render(<ReportGlobalErrors />);

    expect(screen.queryByText(/all/i)).not.toBeInTheDocument();
    expect(screen.getByText("Default failure")).toBeInTheDocument();
    expect(screen.getByText('environment: "default" (1)')).toBeInTheDocument();
    expect(screen.getByText('environment: "QA" (1)')).toBeInTheDocument();
    expect(screen.getByText('environment: "Prod" (1)')).toBeInTheDocument();
  }, 15000);
});
