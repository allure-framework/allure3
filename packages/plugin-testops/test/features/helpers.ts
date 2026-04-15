import { AllureStore } from "@allurereport/plugin-api";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { vi } from "vitest";

import { LaunchCategoryBulkResult, TestOpsLaunch, TestOpsNamedEnv, TestOpsSession } from "../../src/model";

export const mockAllureStore = () => {
  // @ts-expect-error this is only for tests
  class AllureStoreMock implements AllureStore {
    allTestResults = vi.fn().mockResolvedValue([]);
    allGlobalAttachments = vi.fn().mockResolvedValue([]);
    allGlobalErrors = vi.fn().mockResolvedValue([]);
    allEnvironmentIdentities = vi.fn().mockResolvedValue([]);
    environmentIdByTrId = vi.fn().mockResolvedValue(undefined);
    attachmentsByTrId = vi.fn().mockResolvedValue([]);
    attachmentContentById = vi.fn().mockResolvedValue(undefined);
    fixturesByTrId = vi.fn().mockResolvedValue([]);
    qualityGateResults = vi.fn().mockResolvedValue([]);
  }

  return vi.mocked<AllureStore>(new AllureStoreMock() as any);
};

type AxiosPostArgs = [url: string, data?: any, config?: AxiosRequestConfig];

export const mockRequests = () => {
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

export const handleBeforeEach = () => {
  vi.stubEnv("ALLURE_LOG_LEVEL", "silent");
  vi.clearAllMocks();
};
