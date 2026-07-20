import { beforeEach, describe, expect, it, vi } from "vitest";

const fsMock = vi.hoisted(() => ({
  stat: vi.fn(),
}));

const axiosMock = vi.hoisted(() => ({
  create: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    create: axiosMock.create,
  },
  isAxiosError: (err: unknown) => !!(err as { isAxiosError?: boolean })?.isAxiosError,
}));
vi.mock("node:fs/promises", () => ({
  stat: fsMock.stat,
}));

const { KnownError, UnknownError, createServiceHttpClient, formatResponseErrorData, uploadReport } =
  await import("../src/utils/http.js");

const uploadConfig = {
  uploadConcurrency: 100,
  uploadMaxAttempts: 5,
  uploadMaxSimultaneousFailures: 5,
};

const createAxiosError = (payload: { status?: number; statusText?: string; data?: unknown; message?: string }) => ({
  isAxiosError: true,
  message: payload.message ?? "Request failed",
  response:
    payload.status === undefined
      ? undefined
      : {
          status: payload.status,
          statusText: payload.statusText,
          data: payload.data,
        },
  stack: "axios stack",
});

describe("createServiceHttpClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axiosMock.create.mockReturnValue({
      delete: axiosMock.delete,
      get: axiosMock.get,
      post: axiosMock.post,
      put: axiosMock.put,
    });
  });

  it("should throw a KnownError with status, endpoint and response message", async () => {
    axiosMock.post.mockRejectedValue(
      createAxiosError({
        status: 401,
        statusText: "Unauthorized",
        data: {
          message: "API token is expired",
        },
      }),
    );

    const client = createServiceHttpClient("https://testops.example.com", { apiToken: "token" });
    let caught: unknown;

    try {
      await client.post("/api/test-report/report-uuid/upload", { body: new FormData() });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(KnownError);
    expect(caught).toMatchObject({
      status: 401,
      message:
        "Allure service request failed: POST /api/test-report/report-uuid/upload responded with 401 Unauthorized: API token is expired",
    });
  });

  it("should stringify object response bodies instead of printing [object Object]", async () => {
    axiosMock.post.mockRejectedValue(
      createAxiosError({
        status: 400,
        statusText: "Bad Request",
        data: {
          code: "INVALID_REPORT",
          reason: {
            field: "projectId",
          },
        },
      }),
    );

    const client = createServiceHttpClient("https://testops.example.com", { apiToken: "token" });
    let caught: unknown;

    try {
      await client.post("/api/test-report", { body: { projectId: 1 } });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(KnownError);
    expect((caught as Error).message).toContain('{"code":"INVALID_REPORT","reason":{"field":"projectId"}}');
    expect((caught as Error).message).not.toContain("[object Object]");
  });

  it("should include fallback network error messages", async () => {
    axiosMock.get.mockRejectedValue(
      createAxiosError({
        message: "Network Error",
      }),
    );

    const client = createServiceHttpClient("https://testops.example.com", { apiToken: "token" });
    let caught: unknown;

    try {
      await client.get("/api/test-report");
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(UnknownError);
    expect((caught as Error).message).toBe("Allure service request failed: GET /api/test-report failed: Network Error");
  });

  it("should authorize requests with an API token", async () => {
    axiosMock.get.mockResolvedValue({ data: {} });

    const client = createServiceHttpClient("https://testops.example.com", { apiToken: "token" });

    await client.get("/api/test-report");

    expect(axiosMock.get).toHaveBeenCalledWith("/api/test-report", {
      headers: {
        Authorization: "api-token token",
      },
    });
  });

  it("should authorize requests with a bearer access token", async () => {
    axiosMock.get.mockResolvedValue({ data: {} });

    const client = createServiceHttpClient("https://service.example.com", { accessToken: "token" });

    await client.get("/api/reports");

    expect(axiosMock.get).toHaveBeenCalledWith("/api/reports", {
      headers: {
        Authorization: "Bearer token",
      },
    });
  });
});

describe("formatResponseErrorData", () => {
  it("should prefer a human-readable message field", () => {
    expect(
      formatResponseErrorData({
        error: "Unauthorized",
        message: "API token is expired",
        status: 401,
      }),
    ).toBe("API token is expired");
  });

  it("should preserve string error fields", () => {
    expect(
      formatResponseErrorData({
        error: "Project is not available",
      }),
    ).toBe("Project is not available");
  });
});

describe("uploadReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fsMock.stat.mockReset();
  });

  it("routes data files to addReportFile and assets to addReportAsset", async () => {
    const addReportFile = vi.fn().mockResolvedValue("https://example.org/report/index.html");
    const addReportAsset = vi.fn().mockResolvedValue(undefined);

    const result = await uploadReport({
      ...uploadConfig,
      reportUuid: "report-uuid",
      pluginId: "plugin-id",
      files: {
        "index.html": "/tmp/index.html",
        "widgets/summary.json": "/tmp/widgets-summary.json",
        "app.js": "/tmp/app.js",
      },
      addReportFile,
      addReportAsset,
    });

    expect(addReportFile).toHaveBeenCalledTimes(2);
    expect(addReportAsset).toHaveBeenCalledTimes(1);
    expect(result.indexHref).toBe("https://example.org/report/index.html");
  });

  it("chunks files by byte cap without stat overhead when cap is unset", async () => {
    const addReportFiles = vi.fn().mockResolvedValue({});

    await uploadReport({
      ...uploadConfig,
      reportUuid: "report-uuid",
      files: {
        "index.html": "/tmp/index.html",
        "widgets/summary.json": "/tmp/summary.json",
      },
      addReportFiles,
      addReportFile: vi.fn(),
      addReportAsset: vi.fn(),
    });

    expect(fsMock.stat).not.toHaveBeenCalled();
    expect(addReportFiles).toHaveBeenCalledTimes(1);
  });

  it("chunks files by byte cap", async () => {
    const addReportFiles = vi.fn().mockResolvedValue({});
    fsMock.stat.mockImplementation((filepath: string) => {
      const sizes: Record<string, number> = {
        "/tmp/index.html": 6,
        "/tmp/summary.json": 5,
        "/tmp/widgets-summary.json": 4,
      };

      return Promise.resolve({ size: sizes[filepath] } as never);
    });

    await uploadReport({
      ...uploadConfig,
      reportUuid: "report-uuid",
      files: {
        "index.html": "/tmp/index.html",
        "summary.json": "/tmp/summary.json",
        "widgets/summary.json": "/tmp/widgets-summary.json",
      },
      uploadBatchMaxBytes: 10,
      addReportFiles,
      addReportFile: vi.fn(),
      addReportAsset: vi.fn(),
    });

    expect(fsMock.stat).toHaveBeenCalledTimes(3);
    expect(addReportFiles).toHaveBeenCalledTimes(2);
    expect(addReportFiles.mock.calls.map(([payload]) => payload.files.map(({ filename }) => filename))).toEqual([
      ["index.html"],
      ["summary.json", "widgets/summary.json"],
    ]);
  });

  it("uses configured concurrency", async () => {
    let active = 0;
    let maxActive = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const addReportFile = vi.fn().mockImplementation(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await gate;
      active--;

      return "https://example.org/file";
    });

    const promise = uploadReport({
      ...uploadConfig,
      reportUuid: "report-uuid",
      files: Object.fromEntries(
        Array.from({ length: 8 }, (_, index) => [`data/f${index}.json`, `/tmp/f${index}.json`]),
      ),
      uploadConcurrency: 3,
      addReportFile,
      addReportAsset: vi.fn(),
    });

    await Promise.resolve();
    expect(maxActive).toBe(3);
    release();
    await promise;

    expect(addReportFile).toHaveBeenCalledTimes(8);
  });

  it("uses provided upload concurrency of 100", async () => {
    let active = 0;
    let maxActive = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const addReportFile = vi.fn().mockImplementation(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await gate;
      active--;

      return "https://example.org/file";
    });

    const promise = uploadReport({
      ...uploadConfig,
      reportUuid: "report-uuid",
      files: Object.fromEntries(
        Array.from({ length: 105 }, (_, index) => [`data/f${index}.json`, `/tmp/f${index}.json`]),
      ),
      addReportFile,
      addReportAsset: vi.fn(),
    });

    await Promise.resolve();
    expect(maxActive).toBe(100);
    release();
    await promise;

    expect(addReportFile).toHaveBeenCalledTimes(105);
  });

  it("retries failed uploads up to max attempts", async () => {
    const addReportFile = vi
      .fn()
      .mockRejectedValueOnce(new Error("failed"))
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValue("https://example.org/report/index.html");

    const result = await uploadReport({
      ...uploadConfig,
      reportUuid: "report-uuid",
      files: { "index.html": "/tmp/index.html" },
      uploadMaxAttempts: 3,
      addReportFile,
      addReportAsset: vi.fn(),
    });

    expect(addReportFile).toHaveBeenCalledTimes(3);
    expect(result.indexHref).toBe("https://example.org/report/index.html");
  });

  it("fails fast when max simultaneous failures is 0", async () => {
    const addReportFile = vi.fn().mockRejectedValue(new Error("upload failed"));

    await expect(
      uploadReport({
        ...uploadConfig,
        reportUuid: "report-uuid",
        files: {
          "index.html": "/tmp/index.html",
          "widgets/summary.json": "/tmp/summary.json",
        },
        uploadConcurrency: 1,
        uploadMaxAttempts: 10,
        uploadMaxSimultaneousFailures: 0,
        addReportFile,
        addReportAsset: vi.fn(),
      }),
    ).rejects.toThrow("upload failed");

    expect(addReportFile).toHaveBeenCalledTimes(1);
  });
});
