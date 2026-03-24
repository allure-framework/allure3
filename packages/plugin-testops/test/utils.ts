import { vi } from "vitest";

export const BASE_URL = "http://allurereport.org";

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export const TestOpsClientMock = vi.fn(function () {});

TestOpsClientMock.prototype = {
  uploadTestResult: vi.fn(),
  issueOauthToken: vi.fn(),
  createLaunch: vi.fn(),
  createSession: vi.fn(),
  uploadTestResults: vi.fn(),
  uploadGlobalAttachments: vi.fn(),
  uploadGlobalErrors: vi.fn(),
  launchUrl: undefined,
  startUpload: vi.fn(),
  stopUpload: vi.fn(),
};

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
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
};
