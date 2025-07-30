import type { TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext, RealtimeSubscriber } from "@allurereport/plugin-api";
import * as console from "node:console";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { QualityGateRuleMode } from "../src/model.js";
import { QualityGatePlugin } from "../src/plugin.js";

vi.mock("node:console", async (importOriginal) => ({
  ...(await importOriginal()),
  error: vi.fn(),
}));

const fixtures = {
  relativeRule: {
    rule: "testRule",
    mode: QualityGateRuleMode.Relative,
    message: () => "message",
    validate: vi.fn(),
  },
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("QualityGatePlugin", () => {
  describe("general", () => {
    let context: PluginContext;

    beforeEach(async () => {
      const testResults = [
        { id: "1", status: "passed" } as unknown as TestResult,
        { id: "2", status: "failed" } as unknown as TestResult,
      ]
      const plugin = new QualityGatePlugin({
        rules: [
          {
            maxFailures: 0,
            minTestsCount: 10,
            successRate: 0.9,
          }
        ],
        fastFail: false,
      });
      context = {
        dispatcher: {
          sendGlobalError: vi.fn(),
          sendTerminationRequest: vi.fn(),
        },
      } as unknown as PluginContext;
      const store = {
        allTestResults: vi.fn().mockResolvedValue(testResults),
        allKnownIssues: vi.fn().mockResolvedValue([]),
      } as unknown as AllureStore;
      const realtime = {
      } as unknown as RealtimeSubscriber;

      await plugin.start(context, store, realtime);
      await plugin.done(context, store);
    })

    it("should convert quality gate results to a terminal-friendly string", async () => {
      const [[errorMessage]] = (console.error as Mock).mock.calls

      expect(errorMessage).toMatchSnapshot();
    })

    it("should convert quality gate results into test errors", async () => {
      expect(context.dispatcher.sendGlobalError).toHaveBeenNthCalledWith(1, {
        actual: 1,
        expected: 0,
        message: expect.any(String),
      })
      expect(context.dispatcher.sendGlobalError).toHaveBeenNthCalledWith(2, {
        actual: 2,
        expected: 10,
        message: expect.any(String),
      })
      expect(context.dispatcher.sendGlobalError).toHaveBeenNthCalledWith(3, {
        actual: 0.5,
        expected: 0.9,
        message: expect.any(String),
      })
    })
  });

  describe("start", () => {
    it("should not subscribe to test results when there is no rules", async () => {
      const plugin = new QualityGatePlugin({
        rules: [],
        fastFail: false,
        use: [fixtures.relativeRule]
      });
      const context = {} as unknown as PluginContext;
      const store = {} as unknown as AllureStore;
      const realtime = {
        onTestResults: vi.fn(),
      } as unknown as RealtimeSubscriber;

      await plugin.start(context, store, realtime);

      expect(realtime.onTestResults).not.toHaveBeenCalled();
    });

    it("should not subscribe to test results when fastFail is not enabled", async () => {
      const plugin = new QualityGatePlugin({
        rules: [{ testRule: 1 }],
        fastFail: false,
        use: [fixtures.relativeRule]
      });
      const context = {} as unknown as PluginContext;
      const store = {} as unknown as AllureStore;
      const realtime = {
        onTestResults: vi.fn(),
      } as unknown as RealtimeSubscriber;

      await plugin.start(context, store, realtime);

      expect(realtime.onTestResults).not.toHaveBeenCalled();
    });

    it("should subscribe to test results when fastFail is enabled", async () => {
      const plugin = new QualityGatePlugin({
        rules: [{ testRule: 1 }],
        fastFail: true,
        use: [fixtures.relativeRule]
      });
      const context = {} as unknown as PluginContext;
      const store = {} as unknown as AllureStore;
      const realtime = {
        onTestResults: vi.fn(),
      } as unknown as RealtimeSubscriber;

      await plugin.start(context, store, realtime);

      expect(realtime.onTestResults).toHaveBeenCalled();
    });

    it("should do nothing when no rules fail", async () => {
      fixtures.relativeRule.validate.mockResolvedValue({ success: true });

      const plugin = new QualityGatePlugin({
        rules: [{ testRule: 1 }],
        use: [fixtures.relativeRule],
        fastFail: true,
      });
      const context = {
        dispatcher: {
          sendGlobalError: vi.fn(),
          sendTerminationRequest: vi.fn(),
        },
      } as unknown as PluginContext;
      const testResults = [
        { id: "1", status: "passed" } as unknown as TestResult,
        { id: "2", status: "passed" } as unknown as TestResult,
      ];
      const store = {
        testResultById: vi.fn().mockImplementation((id) => {
          return Promise.resolve(testResults.find((tr) => tr.id === id));
        }),
      } as unknown as AllureStore;
      let onTestResultsCallback: ((trIds: string[]) => Promise<void>) | null = null;
      const realtime = {
        onTestResults: vi.fn().mockImplementation((callback) => {
          onTestResultsCallback = callback;
        }),
      } as unknown as RealtimeSubscriber;

      await plugin.start(context, store, realtime);

      expect(realtime.onTestResults).toHaveBeenCalled();
      expect(onTestResultsCallback).not.toBeNull();

      await onTestResultsCallback!([testResults[0].id, testResults[1].id]);

      expect(store.testResultById).toHaveBeenCalledWith(testResults[0].id);
      expect(store.testResultById).toHaveBeenCalledWith(testResults[1].id);
      expect(fixtures.relativeRule.validate).toHaveBeenCalled();
      expect(context.dispatcher.sendGlobalError).not.toHaveBeenCalled();
      expect(context.dispatcher.sendTerminationRequest).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    it("should dispatch terminate process event when at least one rule fails", async () => {
      fixtures.relativeRule.validate.mockResolvedValue({ success: false, actual: 3, expected: 5 });

      const plugin = new QualityGatePlugin({
        rules: [{ testRule: 1 }],
        use: [fixtures.relativeRule],
        fastFail: true,
      });
      const context = {
        dispatcher: {
          sendGlobalError: vi.fn(),
          sendTerminationRequest: vi.fn(),
        },
      } as unknown as PluginContext;
      const testResults = [
        { id: "1", status: "passed" } as unknown as TestResult,
        { id: "2", status: "failed" } as unknown as TestResult,
      ];
      const store = {
        testResultById: vi.fn().mockImplementation((id) => {
          return Promise.resolve(testResults.find((tr) => tr.id === id));
        }),
      } as unknown as AllureStore;
      let onTestResultsCallback: ((trIds: string[]) => Promise<void>) | null = null;
      const realtime = {
        onTestResults: vi.fn().mockImplementation((callback) => {
          onTestResultsCallback = callback;
        }),
      } as unknown as RealtimeSubscriber;

      await plugin.start(context, store, realtime);

      expect(realtime.onTestResults).toHaveBeenCalled();
      expect(onTestResultsCallback).not.toBeNull();

      await onTestResultsCallback!([testResults[0].id, testResults[1].id]);

      expect(store.testResultById).toHaveBeenCalledWith(testResults[0].id);
      expect(store.testResultById).toHaveBeenCalledWith(testResults[1].id);
      expect(fixtures.relativeRule.validate).toHaveBeenCalled();
      expect(context.dispatcher.sendGlobalError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: `Quality Gate (testRule): message`,
          actual: 3,
          expected: 5,
        }),
      );
      expect(context.dispatcher.sendTerminationRequest).toHaveBeenCalledWith(
        1,
        "Quality Gate validation has been failed. Process has been terminated due to fast fail mode is enabled.",
      );
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("done", () => {
    it("should do nothing when there is no rules", async () => {
      const plugin = new QualityGatePlugin({
        rules: [],
        use: [fixtures.relativeRule]
      });
      const context = {
        dispatcher: {
          sendGlobalError: vi.fn(),
          sendTerminationRequest: vi.fn(),
        },
      } as unknown as PluginContext;
      const store = {
        allTestResults: vi.fn().mockResolvedValue([]),
      } as unknown as AllureStore;

      await plugin.done(context, store);

      expect(store.allTestResults).not.toHaveBeenCalled();
      expect(context.dispatcher.sendGlobalError).not.toHaveBeenCalled();
      expect(context.dispatcher.sendTerminationRequest).not.toHaveBeenCalled();
    });

    it("should do nothing when no rules fail", async () => {
      fixtures.relativeRule.validate.mockResolvedValue({ success: true });

      const plugin = new QualityGatePlugin({
        rules: [{ testRule: 1 }],
        use: [fixtures.relativeRule]
      });
      const context = {
        dispatcher: {
          sendGlobalError: vi.fn(),
          sendTerminationRequest: vi.fn(),
        },
      } as unknown as PluginContext;
      const store = {
        allTestResults: vi.fn().mockResolvedValue([]),
      } as unknown as AllureStore;

      await plugin.done(context, store);

      expect(store.allTestResults).toHaveBeenCalled();
      expect(context.dispatcher.sendGlobalError).not.toHaveBeenCalled();
      expect(context.dispatcher.sendTerminationRequest).not.toHaveBeenCalled();
    });

    it("should terminate process when rule fails", async () => {
      fixtures.relativeRule.validate.mockResolvedValue({ success: false, actual: 3, expected: 5 });

      const plugin = new QualityGatePlugin({
        rules: [{ testRule: 5 }],
        use: [fixtures.relativeRule],
      });
      const context = {
        dispatcher: {
          sendGlobalError: vi.fn(),
          sendTerminationRequest: vi.fn(),
        },
      } as unknown as PluginContext;
      const testResults = [
        { id: "1", status: "passed" } as unknown as TestResult,
        { id: "2", status: "failed" } as unknown as TestResult,
      ];
      const store = {
        allTestResults: vi.fn().mockResolvedValue(testResults),
      } as unknown as AllureStore;

      await plugin.done(context, store);

      expect(store.allTestResults).toHaveBeenCalled();
      expect(fixtures.relativeRule.validate).toHaveBeenCalled();

      const validateCall = fixtures.relativeRule.validate.mock.calls[0];

      expect(validateCall[0]).toEqual(testResults);
      expect(validateCall[1]).toEqual(5);
      expect(typeof validateCall[2]).toBe("object");
      expect(context.dispatcher.sendGlobalError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Quality Gate (testRule): message"),
          actual: 3,
          expected: 5,
        }),
      );
      expect(context.dispatcher.sendTerminationRequest).toHaveBeenCalledWith(
        1,
        "Quality Gate validation has been failed",
      );
      expect(console.error).toHaveBeenCalled();
    });

    it("should throw error for unknown rule", async () => {
      const plugin = new QualityGatePlugin({
        rules: [{ unknownRule: 5 }],
        use: [],
      });
      const context = {
        dispatcher: {
          sendGlobalError: vi.fn(),
          sendTerminationRequest: vi.fn(),
        },
      } as unknown as PluginContext;
      const store = {
        allTestResults: vi.fn().mockResolvedValue([]),
      } as unknown as AllureStore;

      await expect(plugin.done(context, store)).rejects.toThrow(
        'Rule unknownRule is not provided. Make sure you have provided it in the "use" field of the quality gate config!',
      );
    });
  });
});
