import { TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginState, QualityGateValidationResult } from "@allurereport/plugin-api";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { TestOpsPlugin } from "../../src/plugin.js";
import { handleBeforeEach, mockAllureStore, mockRequests } from "./helpers.js";

beforeEach(() => {
  handleBeforeEach();
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
    store.allEnvironmentIdentities.mockResolvedValue([]);
    store.environmentIdByTrId.mockResolvedValue(undefined);
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
      allEnvironmentIdentities: vi.fn().mockResolvedValue([]),
      environmentIdByTrId: vi.fn().mockResolvedValue(undefined),
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
