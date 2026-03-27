import { TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginState, QualityGateValidationResult } from "@allurereport/plugin-api";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { LaunchCategoryBulkResult, TestOpsLaunch, TestOpsNamedEnv, TestOpsSession } from "../src/model.js";
import { TestOpsPlugin } from "../src/plugin.js";

const mockAllureStore = () => {
  // @ts-expect-error this is only for tests
  class AllureStoreMock implements AllureStore {
    allTestResults = vi.fn().mockResolvedValue([]);
    allGlobalAttachments = vi.fn().mockResolvedValue([]);
    allGlobalErrors = vi.fn().mockResolvedValue([]);
    allEnvironments = vi.fn().mockResolvedValue([]);
    attachmentsByTrId = vi.fn().mockResolvedValue([]);
    attachmentContentById = vi.fn().mockResolvedValue(undefined);
    fixturesByTrId = vi.fn().mockResolvedValue([]);
    qualityGateResults = vi.fn().mockResolvedValue([]);
  }

  return vi.mocked<AllureStore>(new AllureStoreMock() as any);
};

type AxiosPostArgs = [url: string, data?: any, config?: AxiosRequestConfig];

const mockRequests = () => {
  const closeLaunchRequest = vi.fn().mockResolvedValue({} as AxiosResponse);
  const createLaunchCategoriesBulkRequest = vi
    .fn<(...args: AxiosPostArgs) => Promise<AxiosResponse<LaunchCategoryBulkResult[]>>>()
    .mockResolvedValue({} as AxiosResponse);
  const issueOauthTokenRequest = vi
    .fn()
    .mockResolvedValue({ data: { access_token: "test" } } as AxiosResponse<{ access_token: string }>);
  const startUploadRequest = vi
    .fn<(...args: AxiosPostArgs) => Promise<AxiosResponse<void>>>()
    .mockResolvedValue({} as AxiosResponse);
  const stopUploadRequest = vi
    .fn<(...args: AxiosPostArgs) => Promise<AxiosResponse<void>>>()
    .mockResolvedValue({} as AxiosResponse);

  const createLaunchRequest = vi
    .fn<(...args: AxiosPostArgs) => Promise<AxiosResponse<TestOpsLaunch>>>()
    .mockResolvedValue({ data: { id: 100500 } } as AxiosResponse<TestOpsLaunch>);

  const createSessionRequest = vi
    .fn<(...args: AxiosPostArgs) => Promise<AxiosResponse<TestOpsSession>>>()
    .mockResolvedValue({ data: { id: 777 } } as AxiosResponse<TestOpsSession>);

  const createNamedEnvsRequest = vi
    .fn<(...args: AxiosPostArgs) => Promise<AxiosResponse<Pick<TestOpsNamedEnv, "id" | "externalId">[]>>>()
    .mockResolvedValue({ data: [] as any[] } as AxiosResponse<Pick<TestOpsNamedEnv, "id" | "externalId">[]>);

  const uploadGlobalAttachmentsRequest = vi
    .fn<(...args: AxiosPostArgs) => Promise<AxiosResponse<void>>>()
    .mockResolvedValue({} as AxiosResponse);

  const uploadGlobalErrorsRequest = vi
    .fn<(...args: AxiosPostArgs) => Promise<AxiosResponse<void>>>()
    .mockResolvedValue({} as AxiosResponse);

  const uploadQualityGateResultsRequest = vi
    .fn<(...args: AxiosPostArgs) => Promise<AxiosResponse<void>>>()
    .mockResolvedValue({} as AxiosResponse);

  const uploadAttachmentsForResultRequest = vi
    .fn<(...args: AxiosPostArgs) => Promise<AxiosResponse<void>>>()
    .mockResolvedValue({} as AxiosResponse);

  const uploadFixturesForResultRequest = vi
    .fn<(...args: AxiosPostArgs) => Promise<AxiosResponse<void>>>()
    .mockResolvedValue({} as AxiosResponse);

  const axiosTestInstanse = axios.create({
    baseURL: "https://allurereport.org",
  });

  vi.spyOn(axios, "create").mockReturnValue(axiosTestInstanse);

  vi.spyOn(axiosTestInstanse, "post").mockImplementation((...[url, data, config]: AxiosPostArgs) => {
    if (url.startsWith("/api/launch/") && url.endsWith("/close")) {
      return closeLaunchRequest(url, data, config);
    }

    if (url === "/api/launch/category/bulk") {
      return createLaunchCategoriesBulkRequest(url, data, config);
    }

    if (url === "/api/uaa/oauth/token") {
      return issueOauthTokenRequest(url, data, config);
    }

    if (url === "/api/upload/start") {
      return startUploadRequest(url, data, config);
    }

    if (url === "/api/upload/stop") {
      return stopUploadRequest(url, data, config);
    }

    if (url === "/api/launch") {
      return createLaunchRequest(url, data, config);
    }

    if (url === "/api/upload/session") {
      return createSessionRequest(url, data, config);
    }

    if (url === "/api/launch/named-env/bulk") {
      return createNamedEnvsRequest(url, data, config);
    }

    if (url === "/api/launch/attachment") {
      return uploadGlobalAttachmentsRequest(url, data, config);
    }

    if (url === "/api/launch/error/bulk") {
      return uploadGlobalErrorsRequest(url, data, config);
    }

    if (url === "/api/launch/quality-gate/bulk") {
      return uploadQualityGateResultsRequest(url, data, config);
    }

    if (url === "/api/upload/test-result") {
      return Promise.resolve({
        data: {
          results: (data?.results ?? []).map((result: { id: string }, idx: number) => ({
            id: idx + 1,
            uuid: result.id,
          })),
        },
      } as AxiosResponse<{ results: { id: number; uuid: string }[] }>);
    }

    if (url.startsWith("/api/upload/test-result/") && url.endsWith("/attachment")) {
      return uploadAttachmentsForResultRequest(url, data, config);
    }

    if (url.startsWith("/api/upload/test-result/") && url.endsWith("/test-fixture-result")) {
      return uploadFixturesForResultRequest(url, data, config);
    }
  });

  return {
    closeLaunchRequest,
    createLaunchCategoriesBulkRequest,
    issueOauthTokenRequest,
    startUploadRequest,
    stopUploadRequest,
    createLaunchRequest,
    createSessionRequest,
    createNamedEnvsRequest,
    uploadGlobalAttachmentsRequest,
    uploadGlobalErrorsRequest,
    uploadQualityGateResultsRequest,
    uploadAttachmentsForResultRequest,
    uploadFixturesForResultRequest,
  };
};

beforeEach(() => {
  vi.stubEnv("ALLURE_LOG_LEVEL", "silent");
  vi.clearAllMocks();
});

describe("Quality Gate upload", () => {
  test("should upload only failed and unique quality gate results", async () => {
    const { uploadQualityGateResultsRequest } = mockRequests();
    const plugin = new TestOpsPlugin({
      accessToken: "test",
      endpoint: "http://example.com",
      projectId: "12345",
      launchName: "Test Launch",
      launchTags: [],
      autocloseLaunch: true,
      filter: () => true,
      limit: 10,
    });

    const store = mockAllureStore();

    store.allTestResults.mockResolvedValue([
      {
        id: "tr-1",
        name: "Sample test",
        fullName: "suite Sample test",
        status: "failed",
        stage: "finished",
        start: 1,
        stop: 2,
        steps: [],
      } as unknown as TestResult,
    ]);

    store.allGlobalAttachments.mockResolvedValue([]);
    store.allGlobalErrors.mockResolvedValue([]);
    store.allEnvironments.mockResolvedValue([]);
    store.attachmentsByTrId.mockResolvedValue([]);
    store.fixturesByTrId.mockResolvedValue([]);
    store.qualityGateResults.mockResolvedValue([
      {
        rule: "coverage",
        message: "Coverage below threshold (duplicate)",
        success: false,
      } as QualityGateValidationResult,
      {
        rule: "critical-tests",
        message: "Critical tests failed",
        success: false,
      } as QualityGateValidationResult,
      {
        rule: "flake-rate",
        message: "Flake rate is acceptable",
        success: true,
      } as QualityGateValidationResult,
    ]);

    await plugin.start(
      {
        allureVersion: "3.0.0",
        reportUuid: "test-uuid",
        reportName: "Test Report",
        output: "/tmp/out",
        categories: [],
        publish: true,
        id: "test",
        reportFiles: [] as any,
        state: {} as PluginState,
      },
      store as unknown as AllureStore,
    );

    expect(uploadQualityGateResultsRequest).toHaveBeenCalledTimes(1);
    expect(uploadQualityGateResultsRequest).toHaveBeenCalledWith(
      "/api/launch/quality-gate/bulk",
      {
        launchId: 100500,
        items: [
          {
            name: "coverage",
            message: "Coverage below threshold (duplicate)",
          },
          {
            name: "critical-tests",
            message: "Critical tests failed",
          },
        ],
      },
      expect.any(Object),
    );
  });

  test("should not upload quality gate when there are no failed results", async () => {
    const { uploadQualityGateResultsRequest } = mockRequests();
    const plugin = new TestOpsPlugin({
      accessToken: "test",
      endpoint: "http://example.com",
      projectId: "12345",
      launchName: "Test Launch",
      launchTags: [],
      autocloseLaunch: true,
      filter: () => true,
      limit: 10,
    });

    const store = {
      allTestResults: vi.fn().mockResolvedValue([
        {
          id: "tr-1",
          name: "Sample test",
          fullName: "suite Sample test",
          status: "passed",
          stage: "finished",
          start: 1,
          stop: 2,
          steps: [],
        } as unknown as TestResult,
      ]),
      allGlobalAttachments: vi.fn().mockResolvedValue([]),
      allGlobalErrors: vi.fn().mockResolvedValue([]),
      allEnvironments: vi.fn().mockResolvedValue([]),
      attachmentsByTrId: vi.fn().mockResolvedValue([]),
      fixturesByTrId: vi.fn().mockResolvedValue([]),
      qualityGateResults: vi.fn().mockResolvedValue([
        {
          rule: "coverage",
          message: "Coverage is OK",
          success: true,
        } as QualityGateValidationResult,
      ]),
    } as unknown as AllureStore;

    await plugin.start(
      {
        allureVersion: "3.0.0",
        reportUuid: "test-uuid",
        reportName: "Test Report",
        output: "/tmp/out",
        categories: [],
        publish: true,
        id: "test",
        reportFiles: [] as any,
        state: {} as PluginState,
      },
      store as unknown as AllureStore,
    );

    expect(uploadQualityGateResultsRequest).not.toHaveBeenCalled();
  });
});
