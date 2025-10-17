import type { TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext } from "@allurereport/plugin-api";
import axios from "axios";
import { describe, expect, it, vi } from "vitest";
import type { JiraPluginOptions } from "../src/plugin.js";
import { JiraPlugin } from "../src/plugin.js";

const createMockStore = (partialStore: Partial<AllureStore>): AllureStore => {
  const defaultStore = {
    testsStatistic: vi.fn().mockResolvedValue({ total: 0, passed: 0, failed: 0, broken: 0, skipped: 0, unknown: 0 }),
    allTestResults: vi.fn().mockResolvedValue([]),
    allHistoryDataPoints: vi.fn().mockResolvedValue([]),
    allGlobalErrors: vi.fn().mockResolvedValue([]),
    globalExitCode: vi.fn().mockResolvedValue({ actual: 0, original: 0 }),
    allEnvironments: vi.fn().mockResolvedValue([]),
    retriesByTr: vi.fn().mockResolvedValue([]),
  };
  return { ...defaultStore, ...partialStore } as AllureStore;
};

const defaultPluginContext = {
  reportUrl: "http://example.com/report",
  reportUuid: "test-uuid",
  reportName: "Test Report",
  ci: {
    jobUrl: "http://ci.example.com/job/123",
    jobName: "Test Job",
  },
} as PluginContext;

const defaultOptions = {
  token: "test-token",
  webhook: "http://example.com/webhook",
} as JiraPluginOptions;

const createTestResult = (overrides: Partial<TestResult> = {}): TestResult =>
  ({
    id: "test-1",
    name: "Test 1",
    status: "passed",
    historyId: "hist-1",
    stop: Date.now(),
    links: [],
    parameters: [],
    flaky: false,
    muted: false,
    known: false,
    hidden: false,
    labels: [],
    steps: [],
    sourceMetadata: undefined,
    ...overrides,
  }) as TestResult;

const createJiraTestResult = (name = "Test with Jira link"): TestResult =>
  createTestResult({
    name,
    links: [
      {
        name: "Jira Issue",
        url: "https://company.atlassian.net/browse/PROJ-123",
        type: "issue",
      },
    ],
  });

const setupAxiosSpy = () => {
  const spy = vi.spyOn(axios, "post");
  spy.mockResolvedValue({ data: { success: true } } as any);
  return spy;
};

describe("JiraPlugin", () => {
  describe("Options validation", () => {
    it("should throw error if token is not provided", async () => {
      const plugin = new JiraPlugin({ ...defaultOptions, token: undefined, uploadReport: true });

      await expect(plugin.done(defaultPluginContext, createMockStore({}))).rejects.toThrow(
        "[Allure Jira Plugin] token is not set",
      );
    });

    it("should throw error if webhook is not provided", async () => {
      const plugin = new JiraPlugin({ ...defaultOptions, webhook: undefined, uploadReport: true });

      await expect(plugin.done(defaultPluginContext, createMockStore({}))).rejects.toThrow(
        "[Allure Jira Plugin] webhook is not set",
      );
    });

    it("should throw error if neither uploadReport nor uploadResults is enabled", async () => {
      const plugin = new JiraPlugin(defaultOptions);

      await expect(plugin.done(defaultPluginContext, createMockStore({}))).rejects.toThrow(
        "[Allure Jira Plugin] Set at least one of the options: uploadReport or uploadResults",
      );
    });
  });

  describe("Results upload", () => {
    it("should successfully upload results", async () => {
      const testResult = createJiraTestResult("Test 1");

      testResult.parameters = [{ name: "param1", value: "value1", excluded: false, hidden: false, masked: false }];
      testResult.environment = "test";

      const mockStore = createMockStore({
        allTestResults: vi.fn().mockResolvedValue([testResult]),
        retriesByTr: vi.fn().mockResolvedValue([]),
        testsStatistic: vi.fn().mockResolvedValue({}),
      });

      const axiosPostSpy = setupAxiosSpy();

      const plugin = new JiraPlugin({ ...defaultOptions, uploadResults: true });

      await plugin.done(defaultPluginContext, mockStore);

      expect(axiosPostSpy).toHaveBeenCalledWith(
        defaultOptions.webhook,
        expect.objectContaining({
          operation: "upload-results",
          version: "v1",
          token: defaultOptions.token,
          payload: expect.objectContaining({
            results: [
              expect.objectContaining({
                id: "hist-1",
                name: "Test 1",
                issue: expect.objectContaining({
                  url: "https://company.atlassian.net/browse/PROJ-123",
                }),
                keyParams: [{ name: "param1", value: "value1" }],
              }),
            ],
            reportUrl: "http://example.com/report",
          }),
        }),
      );
    });

    it("should include parameters that have same values across different environments", async () => {
      const testResult1 = createJiraTestResult("Test with same params");
      testResult1.id = "test-1";
      testResult1.historyId = "hist-same";
      testResult1.environment = "dev";
      testResult1.parameters = [
        { name: "browser", value: "chrome", excluded: false, hidden: false, masked: false },
        { name: "version", value: "1.0", excluded: false, hidden: false, masked: false },
      ];

      const testResult2 = createJiraTestResult("Test with same params");
      testResult2.id = "test-2";
      testResult2.historyId = "hist-same";
      testResult2.environment = "prod";
      testResult2.parameters = [
        { name: "browser", value: "chrome", excluded: false, hidden: false, masked: false },
        { name: "version", value: "1.0", excluded: false, hidden: false, masked: false },
      ];

      const mockStore = createMockStore({
        allTestResults: vi.fn().mockResolvedValue([testResult1, testResult2]),
        retriesByTr: vi.fn().mockResolvedValue([]),
        testsStatistic: vi.fn().mockResolvedValue({}),
      });

      const axiosPostSpy = setupAxiosSpy();
      const plugin = new JiraPlugin({ ...defaultOptions, uploadResults: true });

      await plugin.done(defaultPluginContext, mockStore);

      expect(axiosPostSpy).toHaveBeenCalledWith(
        defaultOptions.webhook,
        expect.objectContaining({
          payload: expect.objectContaining({
            results: [
              expect.objectContaining({
                id: "hist-same",
                keyParams: [
                  { name: "browser", value: "chrome" },
                  { name: "version", value: "1.0" },
                ],
                entries: expect.arrayContaining([
                  expect.objectContaining({ env: "dev" }),
                  expect.objectContaining({ env: "prod" }),
                ]),
              }),
            ],
          }),
        }),
      );
    });

    it("should exclude parameters that have different values across environments", async () => {
      const testResult1 = createJiraTestResult("Test with different params");
      testResult1.id = "test-1";
      testResult1.historyId = "hist-diff";
      testResult1.environment = "dev";
      testResult1.parameters = [
        { name: "browser", value: "chrome", excluded: false, hidden: false, masked: false },
        { name: "timeout", value: "30s", excluded: false, hidden: false, masked: false },
      ];

      const testResult2 = createJiraTestResult("Test with different params");
      testResult2.id = "test-2";
      testResult2.historyId = "hist-diff";
      testResult2.environment = "prod";
      testResult2.parameters = [
        { name: "browser", value: "chrome", excluded: false, hidden: false, masked: false },
        { name: "timeout", value: "60s", excluded: false, hidden: false, masked: false },
      ];

      const mockStore = createMockStore({
        allTestResults: vi.fn().mockResolvedValue([testResult1, testResult2]),
        retriesByTr: vi.fn().mockResolvedValue([]),
        testsStatistic: vi.fn().mockResolvedValue({}),
      });

      const axiosPostSpy = setupAxiosSpy();
      const plugin = new JiraPlugin({ ...defaultOptions, uploadResults: true });

      await plugin.done(defaultPluginContext, mockStore);

      expect(axiosPostSpy).toHaveBeenCalledWith(
        defaultOptions.webhook,
        expect.objectContaining({
          payload: expect.objectContaining({
            results: [
              expect.objectContaining({
                id: "hist-diff",
                keyParams: [{ name: "browser", value: "chrome" }],
                entries: expect.arrayContaining([
                  expect.objectContaining({ env: "dev" }),
                  expect.objectContaining({ env: "prod" }),
                ]),
              }),
            ],
          }),
        }),
      );
    });

    it("should exclude hidden and excluded parameters from keyParams", async () => {
      const testResult = createJiraTestResult("Test with hidden/excluded params");
      testResult.parameters = [
        { name: "visible", value: "value1", excluded: false, hidden: false, masked: false },
        { name: "hidden", value: "value2", excluded: false, hidden: true, masked: false },
        { name: "excluded", value: "value3", excluded: true, hidden: false, masked: false },
        { name: "both", value: "value4", excluded: true, hidden: true, masked: false },
      ];

      const mockStore = createMockStore({
        allTestResults: vi.fn().mockResolvedValue([testResult]),
        retriesByTr: vi.fn().mockResolvedValue([]),
        testsStatistic: vi.fn().mockResolvedValue({}),
      });

      const axiosPostSpy = setupAxiosSpy();
      const plugin = new JiraPlugin({ ...defaultOptions, uploadResults: true });

      await plugin.done(defaultPluginContext, mockStore);

      expect(axiosPostSpy).toHaveBeenCalledWith(
        defaultOptions.webhook,
        expect.objectContaining({
          payload: expect.objectContaining({
            results: [
              expect.objectContaining({
                keyParams: [{ name: "visible", value: "value1" }],
              }),
            ],
          }),
        }),
      );
    });

    it("should handle multiple test entries with mixed parameter scenarios", async () => {
      const testResult1 = createJiraTestResult("Complex test");
      testResult1.id = "test-1";
      testResult1.historyId = "hist-complex";
      testResult1.environment = "env1";
      testResult1.parameters = [
        { name: "common", value: "shared", excluded: false, hidden: false, masked: false },
        { name: "different", value: "val1", excluded: false, hidden: false, masked: false },
        { name: "hidden", value: "secret", excluded: false, hidden: true, masked: false },
      ];

      const testResult2 = createJiraTestResult("Complex test");
      testResult2.id = "test-2";
      testResult2.historyId = "hist-complex";
      testResult2.environment = "env2";
      testResult2.parameters = [
        { name: "common", value: "shared", excluded: false, hidden: false, masked: false },
        { name: "different", value: "val2", excluded: false, hidden: false, masked: false },
        { name: "excluded", value: "ignored", excluded: true, hidden: false, masked: false },
      ];

      const testResult3 = createJiraTestResult("Complex test");
      testResult3.id = "test-3";
      testResult3.historyId = "hist-complex";
      testResult3.environment = "env3";
      testResult3.parameters = [
        { name: "common", value: "shared", excluded: false, hidden: false, masked: false },
        { name: "different", value: "val3", excluded: false, hidden: false, masked: false },
      ];

      const mockStore = createMockStore({
        allTestResults: vi.fn().mockResolvedValue([testResult1, testResult2, testResult3]),
        retriesByTr: vi.fn().mockResolvedValue([]),
        testsStatistic: vi.fn().mockResolvedValue({}),
      });

      const axiosPostSpy = setupAxiosSpy();
      const plugin = new JiraPlugin({ ...defaultOptions, uploadResults: true });

      await plugin.done(defaultPluginContext, mockStore);

      expect(axiosPostSpy).toHaveBeenCalledWith(
        defaultOptions.webhook,
        expect.objectContaining({
          payload: expect.objectContaining({
            results: [
              expect.objectContaining({
                id: "hist-complex",
                keyParams: expect.arrayContaining([{ name: "common", value: "shared" }]),
                entries: [
                  expect.objectContaining({ env: "env1" }),
                  expect.objectContaining({ env: "env2" }),
                  expect.objectContaining({ env: "env3" }),
                ],
              }),
            ],
          }),
        }),
      );
    });

    it("should handle tests without parameters", async () => {
      const testResult = createJiraTestResult("Test without params");
      testResult.parameters = [];

      const mockStore = createMockStore({
        allTestResults: vi.fn().mockResolvedValue([testResult]),
        retriesByTr: vi.fn().mockResolvedValue([]),
        testsStatistic: vi.fn().mockResolvedValue({}),
      });

      const axiosPostSpy = setupAxiosSpy();
      const plugin = new JiraPlugin({ ...defaultOptions, uploadResults: true });

      await plugin.done(defaultPluginContext, mockStore);

      expect(axiosPostSpy).toHaveBeenCalledWith(
        defaultOptions.webhook,
        expect.objectContaining({
          payload: expect.objectContaining({
            results: [
              expect.objectContaining({
                id: "hist-1",
                keyParams: [],
              }),
            ],
          }),
        }),
      );
    });

    it("should throw error if no test results found for upload", async () => {
      const plugin = new JiraPlugin({ ...defaultOptions, uploadResults: true });

      await expect(
        plugin.done(defaultPluginContext, createMockStore({ allTestResults: vi.fn().mockResolvedValue([]) })),
      ).rejects.toThrow("[Allure Jira Plugin] no test results found");
    });

    it("should upload only test results with valid Jira links", async () => {
      const mockTestResults = [
        createJiraTestResult("Test with Jira link"),
        createTestResult({
          id: "test-2",
          name: "Test without Jira link",
          status: "failed",
          historyId: "hist-2",
          links: [
            {
              name: "GitHub Issue",
              url: "https://github.com/company/repo/issues/123",
              type: "issue",
            },
          ],
        }),
        createTestResult({
          id: "test-3",
          name: "Test with invalid Jira URL",
          historyId: "hist-3",
          links: [
            {
              name: "Invalid Jira",
              url: "https://invalid-jira.com/browse/PROJ-456",
              type: "issue",
            },
          ],
        }),
      ];

      const mockStore = createMockStore({
        allTestResults: vi.fn().mockResolvedValue(mockTestResults),
        retriesByTr: vi.fn().mockResolvedValue([]),
        testsStatistic: vi.fn().mockResolvedValue({}),
      });
      const axiosPostSpy = vi.spyOn(axios, "post");

      const plugin = new JiraPlugin({
        token: "test-token",
        webhook: "http://example.com/webhook",
        uploadResults: true,
      });

      axiosPostSpy.mockResolvedValue({ data: { success: true } } as any);

      await plugin.done(defaultPluginContext, mockStore);

      expect(axiosPostSpy).toHaveBeenCalledWith(
        "http://example.com/webhook",
        expect.objectContaining({
          operation: "upload-results",
          version: "v1",
          token: "test-token",
          payload: expect.objectContaining({
            results: [
              expect.objectContaining({
                id: "hist-1",
                name: "Test with Jira link",
                issue: expect.objectContaining({
                  url: "https://company.atlassian.net/browse/PROJ-123",
                }),
              }),
            ],
            reportUrl: "http://example.com/report",
          }),
        }),
      );
    });
  });

  describe("Report upload", () => {
    it("should successfully upload report", async () => {
      const mockTestResults = [createTestResult()];

      const mockStore = createMockStore({
        allTestResults: vi.fn().mockResolvedValue(mockTestResults),
        allHistoryDataPoints: vi.fn().mockResolvedValue([{ uuid: "hist-1" } as any]),
        allGlobalErrors: vi.fn().mockResolvedValue([]),
        globalExitCode: vi.fn().mockResolvedValue({ actual: 0, original: 0 }),
        allEnvironments: vi.fn().mockResolvedValue([]),
        retriesByTr: vi.fn().mockResolvedValue([]),
        testsStatistic: vi
          .fn()
          .mockResolvedValue({ total: 1, passed: 1, failed: 0, broken: 0, skipped: 0, unknown: 0 }),
      });
      const axiosPostSpy = vi.spyOn(axios, "post");

      const plugin = new JiraPlugin({
        token: "test-token",
        webhook: "http://example.com/webhook",
        issue: "PROJ-123",
        uploadReport: true,
      });

      axiosPostSpy.mockResolvedValue({ data: { success: true } } as any);

      await plugin.done(defaultPluginContext, mockStore);

      expect(axiosPostSpy).toHaveBeenCalledWith(
        "http://example.com/webhook",
        expect.objectContaining({
          operation: "upload-report",
          version: "v1",
          token: "test-token",
          payload: expect.objectContaining({
            issue: "PROJ-123",
            report: expect.objectContaining({
              id: "test-uuid",
              name: "Test Report",
              url: "http://example.com/report",
              status: "passed",
              statistic: expect.objectContaining({
                total: 1,
                passed: 1,
              }),
              history: expect.arrayContaining(["hist-1"]),
              date: expect.any(Number),
              ciInfo: expect.objectContaining({
                url: "http://ci.example.com/job/123",
                label: "Test Job",
              }),
              statisticByEnv: expect.any(Object),
            }),
          }),
        }),
      );
    });

    it("should throw error if no test results found for report", async () => {
      const plugin = new JiraPlugin({
        token: "test-token",
        webhook: "http://example.com/webhook",
        issue: "PROJ-123",
        uploadReport: true,
      });

      const mockStore = createMockStore({
        allTestResults: vi.fn().mockResolvedValue([]),
        testsStatistic: vi
          .fn()
          .mockResolvedValue({ total: 0, passed: 0, failed: 0, broken: 0, skipped: 0, unknown: 0 }),
      });

      await expect(plugin.done(defaultPluginContext, mockStore)).rejects.toThrow(
        "[Allure Jira Plugin] no test results found",
      );
    });
  });

  describe("Reports clearing from Jira issue", () => {
    it("should successfully clear reports", async () => {
      const axiosPostSpy = setupAxiosSpy();
      const plugin = new JiraPlugin(defaultOptions);

      await plugin.clearReports(["PROJ-123", "PROJ-456"]);

      expect(axiosPostSpy).toHaveBeenCalledWith(
        defaultOptions.webhook,
        expect.objectContaining({
          operation: "clear",
          version: "v1",
          token: defaultOptions.token,
          payload: { issues: ["PROJ-123", "PROJ-456"], reports: true },
        }),
      );
    });
  });

  describe("Results clearing from Jira issue", () => {
    it("should successfully clear results", async () => {
      const axiosPostSpy = setupAxiosSpy();
      const plugin = new JiraPlugin(defaultOptions);

      await plugin.clearResults(["PROJ-123", "PROJ-456"]);

      expect(axiosPostSpy).toHaveBeenCalledWith(
        defaultOptions.webhook,
        expect.objectContaining({
          operation: "clear",
          version: "v1",
          token: defaultOptions.token,
          payload: { issues: ["PROJ-123", "PROJ-456"], results: true },
        }),
      );
    });
  });

  describe("Clearing both reports and results from Jira issue", () => {
    it("should successfully clear all data", async () => {
      const axiosPostSpy = setupAxiosSpy();
      const plugin = new JiraPlugin(defaultOptions);

      await plugin.clearAll(["PROJ-123", "PROJ-456"]);

      expect(axiosPostSpy).toHaveBeenCalledWith(
        defaultOptions.webhook,
        expect.objectContaining({
          operation: "clear",
          version: "v1",
          token: defaultOptions.token,
          payload: { issues: ["PROJ-123", "PROJ-456"], reports: true, results: true },
        }),
      );
    });
  });

  describe("Uploading both report and results", () => {
    it("should upload both report and results when both are enabled", async () => {
      const mockTestResults = [createJiraTestResult("Test 1")];
      const mockStore = createMockStore({
        allTestResults: vi.fn().mockResolvedValue(mockTestResults),
        allHistoryDataPoints: vi.fn().mockResolvedValue([{ uuid: "hist-1" } as any]),
        allGlobalErrors: vi.fn().mockResolvedValue([]),
        globalExitCode: vi.fn().mockResolvedValue({ actual: 0, original: 0 }),
        allEnvironments: vi.fn().mockResolvedValue([]),
        retriesByTr: vi.fn().mockResolvedValue([]),
        testsStatistic: vi.fn().mockResolvedValue({}),
      });
      const axiosPostSpy = vi.spyOn(axios, "post");

      const plugin = new JiraPlugin({
        token: "test-token",
        webhook: "http://example.com/webhook",
        issue: "PROJ-123",
        uploadReport: true,
        uploadResults: true,
      });

      axiosPostSpy.mockResolvedValue({ data: { success: true } } as any);

      await plugin.done(defaultPluginContext, mockStore);

      expect(axiosPostSpy).toHaveBeenCalledTimes(2);
      expect(axiosPostSpy).toHaveBeenNthCalledWith(
        1,
        "http://example.com/webhook",
        expect.objectContaining({
          operation: "upload-report",
          payload: expect.objectContaining({
            issue: "PROJ-123",
          }),
        }),
      );
      expect(axiosPostSpy).toHaveBeenNthCalledWith(
        2,
        "http://example.com/webhook",
        expect.objectContaining({
          operation: "upload-results",
          payload: expect.objectContaining({
            results: [
              expect.objectContaining({
                id: "hist-1",
                name: "Test 1",
              }),
            ],
          }),
        }),
      );
    });
  });
});
