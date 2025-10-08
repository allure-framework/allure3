import type { TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext } from "@allurereport/plugin-api";
import axios from "axios";
import { describe, expect, it, vi } from "vitest";
import type { JiraPluginOptions } from "../src/plugin.js";
import { JiraPlugin } from "../src/plugin.js";

const createMockStore = (partialStore: Partial<AllureStore>): AllureStore => partialStore as AllureStore;

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
              }),
            ],
            reportUrl: "http://example.com/report",
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

      await expect(
        plugin.done(defaultPluginContext, createMockStore({ allTestResults: vi.fn().mockResolvedValue([]) })),
      ).rejects.toThrow("[Allure Jira Plugin] no test results found");
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
