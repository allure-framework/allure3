import { vi } from "vitest";

export const BASE_URL = "http://allurereport.org";

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export const TestOpsClientMock = vi.fn(function () {});

TestOpsClientMock.prototype = {
  uploadTestResult: vi.fn(),
  issueOauthToken: vi.fn(),
  createLaunch: vi.fn(),
  createSession: vi.fn(),
  createNamedEnvs: vi.fn(),
  uploadTestResults: vi.fn().mockImplementation(async ({ trs }) => trs),
  uploadGlobalAttachments: vi.fn(),
  uploadGlobalErrors: vi.fn(),
  isTestOpsClientError: vi.fn().mockReturnValue(false),
  launchUrl: undefined,
  launchId: 123,
  namedEnvs: [],
  startUpload: vi.fn(),
  stopUpload: vi.fn(),
  createLaunchCategoriesBulk: vi.fn().mockResolvedValue([]),
  closeLaunch: vi.fn(),
};

export const AllureStoreMock = vi.fn(function () {});

AllureStoreMock.prototype = {
  allTestResults: vi.fn(),
  allNewTestResults: vi.fn(),
  allEnvironments: vi.fn(),
  allGlobalErrors: vi.fn(),
  allGlobalAttachments: vi.fn(),
  attachmentsByTrId: vi.fn(),
  attachmentContentById: vi.fn(),
  fixturesByTrId: vi.fn(),
  testsStatistic: vi.fn(),
  qualityGateResults: vi.fn().mockResolvedValue([]),
};

export const AxiosMock = {
  defaults: {
    baseURL: BASE_URL,
  },
  interceptors: {
    request: {
      use: vi.fn(),
    },
  },
  post: vi.fn(),
  postForm: vi.fn(),
};
