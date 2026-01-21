import { vi } from "vitest";

export const BASE_URL = "http://allurereport.org";

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export const TestOpsClientMock = vi.fn(function () {});

TestOpsClientMock.prototype = {
  uploadTestResult: vi.fn(),
  issueOauthToken: vi.fn(),
  createLaunch: vi.fn(),
  createSession: vi.fn(),
  initialize: vi.fn(),
  uploadTestResults: vi.fn(),
};

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export const AllureStoreMock = vi.fn(function () {});

AllureStoreMock.prototype = {
  allTestResults: vi.fn(),
  attachmentsByTrId: vi.fn(),
  attachmentContentById: vi.fn(),
  fixturesByTrId: vi.fn(),
};

export const AxiosMock = {
  defaults: {
    baseURL: BASE_URL,
  },
  post: vi.fn(),
};
