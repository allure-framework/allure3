import { beforeEach, describe, expect, it, vi } from "vitest";

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

const { KnownError, UnknownError, createServiceHttpClient, formatResponseErrorData } =
  await import("../src/utils/http.js");

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

    const client = createServiceHttpClient("https://testops.example.com", "token");
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

    const client = createServiceHttpClient("https://testops.example.com", "token");
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

    const client = createServiceHttpClient("https://testops.example.com", "token");
    let caught: unknown;

    try {
      await client.get("/api/test-report");
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(UnknownError);
    expect((caught as Error).message).toBe("Allure service request failed: GET /api/test-report failed: Network Error");
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
