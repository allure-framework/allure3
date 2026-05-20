import { env } from "node:process";

/* eslint max-lines: off */
import { detect } from "@allurereport/ci";
import type { AttachmentLink, CategoryDefinition, CiDescriptor, TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext } from "@allurereport/plugin-api";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Logger } from "../src/logger.js";
import type { TestOpsPluginOptions } from "../src/model.js";
import { TestOpsPlugin } from "../src/plugin.js";
import { resolvePluginOptions } from "../src/utils.js";
import { AllureStoreMock, TestOpsClientMock } from "./utils.js";

const { AllureTestOpsClientMock } = vi.hoisted(() => {
  const mock = vi.fn(function () {});

  mock.prototype = {
    createReport: vi.fn(),
    addReportFile: vi.fn(),
    addReportAsset: vi.fn(),
    deleteReport: vi.fn(),
    completeReport: vi.fn(),
  };

  return { AllureTestOpsClientMock: mock };
});

vi.mock("@allurereport/ci", () => ({
  detect: vi.fn(),
}));

vi.mock("../src/client.js", async () => {
  const utils = await import("./utils.js");

  return {
    TestOpsClient: utils.TestOpsClientMock,
  };
});

vi.mock("@allurereport/service", () => ({
  AllureTestOpsClient: AllureTestOpsClientMock,
}));

vi.mock("../src/utils.js", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    resolvePluginOptions: vi.fn(),
  };
});

const fixtures = {
  accessToken: "test",
  endpoint: "http://example.com",
  projectId: "12345",
  attachmentContent: {
    asBuffer: async () => Buffer.from("test"),
  },
  testResults: [
    {
      id: "0-0-0-0",
      steps: [
        {
          name: "step without attachments",
        },
      ],
    },
    {
      id: "0-0-0-1",
      steps: [
        {
          name: "step with attachments",
          type: "attachment",
          link: {
            id: "0-0-1-0",
            originalFileName: "attachment.txt",
            contentType: "text/plain",
          },
        },
      ],
    },
  ] as TestResult[],
  attachments: [
    {
      id: "0-0-1-0",
      originalFileName: "attachment.txt",
      contentType: "text/plain",
    },
  ] as AttachmentLink[],
  launchTags: ["tag1", "tag2", "tag3"],
  launchUrl: "http://allurereport.org/launch/123",
  pluginSummary: {
    name: "Allure Report",
    remoteHref: "http://allurereport.org/launch/123",
    stats: { total: 2, passed: 1, failed: 1 },
    status: "failed",
    duration: 2000,
    createdAt: 1000,
    plugin: "Awesome",
    newTests: [],
    flakyTests: [],
    retryTests: [],
    meta: { reportUuid: "test-uuid" },
  },
};

const createDeferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
};

beforeEach(() => {
  vi.stubEnv("ALLURE_LOG_LEVEL", "silent");
  vi.clearAllMocks();
  (detect as unknown as Mock).mockReturnValue({ type: "local" } as CiDescriptor);
  AllureStoreMock.prototype.allEnvironmentIdentities.mockResolvedValue([]);
  AllureStoreMock.prototype.environmentIdByTrId.mockResolvedValue(undefined);
  AllureStoreMock.prototype.allGlobalErrors.mockResolvedValue([]);
  AllureStoreMock.prototype.allGlobalAttachments.mockResolvedValue([]);
});

describe("testops plugin", () => {
  let plugin: TestOpsPlugin;
  let store: AllureStore;

  describe("constructor", () => {
    it("should call resolvePluginOptions with provided options", () => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
        launchName: "Allure Report",
        launchTags: [],
        createLaunch: true,
      });

      const options = {
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
      } as TestOpsPluginOptions;

      new TestOpsPlugin(options);

      expect(resolvePluginOptions).toHaveBeenCalledWith(options);
    });

    it("should not initialize client when accessToken is missing", () => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: "",
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
        launchName: "Allure Report",
        launchTags: [],
        createLaunch: true,
      });

      plugin = new TestOpsPlugin({} as TestOpsPluginOptions);

      expect(plugin).toBeInstanceOf(TestOpsPlugin);
      expect(TestOpsClientMock).not.toHaveBeenCalled();
    });

    it("should not initialize client when endpoint is missing", () => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: "",
        projectId: fixtures.projectId,
        launchName: "Allure Report",
        launchTags: [],
        createLaunch: true,
      });

      plugin = new TestOpsPlugin({} as TestOpsPluginOptions);

      expect(plugin).toBeInstanceOf(TestOpsPlugin);
      expect(TestOpsClientMock).not.toHaveBeenCalled();
    });

    it("should not initialize client when projectId is missing", () => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: "",
        launchName: "Allure Report",
        launchTags: [],
        createLaunch: true,
      });

      plugin = new TestOpsPlugin({} as TestOpsPluginOptions);

      expect(plugin).toBeInstanceOf(TestOpsPlugin);
      expect(TestOpsClientMock).not.toHaveBeenCalled();
    });

    it("should create a new instance and initialize testops client with the resolved options", () => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
        launchName: "Allure Report",
        launchTags: [],
        createLaunch: true,
      });

      plugin = new TestOpsPlugin({} as TestOpsPluginOptions);

      expect(plugin).toBeInstanceOf(TestOpsPlugin);
      expect(TestOpsClientMock).toHaveBeenCalledWith({
        baseUrl: fixtures.endpoint,
        accessToken: fixtures.accessToken,
        projectId: fixtures.projectId,
      });
      expect(AllureTestOpsClientMock).not.toHaveBeenCalled();
    });
  });

  describe("start", () => {
    describe("ci mode", () => {
      it("should return true from ciMode getter when ci is detected and not local", () => {
        (detect as unknown as Mock).mockReturnValue({ type: "github" } as CiDescriptor);
        (resolvePluginOptions as Mock).mockReturnValue({
          accessToken: fixtures.accessToken,
          endpoint: fixtures.endpoint,
          projectId: fixtures.projectId,
          launchName: "Allure Report",
          launchTags: fixtures.launchTags,
          createLaunch: true,
        });

        plugin = new TestOpsPlugin({} as TestOpsPluginOptions);

        expect(plugin.ciMode).toBe(true);
      });

      it("should start upload when ci is detected (non-local)", async () => {
        (detect as unknown as Mock).mockReturnValue({ type: "github" } as CiDescriptor);
        (resolvePluginOptions as Mock).mockReturnValue({
          accessToken: fixtures.accessToken,
          endpoint: fixtures.endpoint,
          projectId: fixtures.projectId,
          launchName: "Allure Report",
          launchTags: fixtures.launchTags,
          createLaunch: true,
        });

        store = new AllureStoreMock() as unknown as AllureStore;

        AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
        AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
        AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
        AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

        plugin = new TestOpsPlugin({} as TestOpsPluginOptions);

        await plugin.start({ reportUuid: "test-uuid" } as PluginContext, store);

        expect(TestOpsClientMock.prototype.startUpload).toHaveBeenCalledTimes(1);
        expect(TestOpsClientMock.prototype.startUpload).toHaveBeenCalledWith({ type: "github" });
      });
    });

    describe("outside ci mode", () => {
      it("should return false from ciMode getter when ci is local", () => {
        (detect as unknown as Mock).mockReturnValue({ type: "local" } as CiDescriptor);
        (resolvePluginOptions as Mock).mockReturnValue({
          accessToken: fixtures.accessToken,
          endpoint: fixtures.endpoint,
          projectId: fixtures.projectId,
          launchName: "Allure Report",
          launchTags: fixtures.launchTags,
          createLaunch: true,
        });

        plugin = new TestOpsPlugin({} as TestOpsPluginOptions);

        expect(plugin.ciMode).toBe(false);
      });

      it("should not start upload when ci is local", async () => {
        (detect as unknown as Mock).mockReturnValue({ type: "local" } as CiDescriptor);
        (resolvePluginOptions as Mock).mockReturnValue({
          accessToken: fixtures.accessToken,
          endpoint: fixtures.endpoint,
          projectId: fixtures.projectId,
          launchName: "Allure Report",
          launchTags: fixtures.launchTags,
          createLaunch: true,
        });

        store = new AllureStoreMock() as unknown as AllureStore;

        AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
        AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
        AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
        AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

        plugin = new TestOpsPlugin({} as TestOpsPluginOptions);

        await plugin.start({ reportUuid: "test-uuid" } as PluginContext, store);

        expect(TestOpsClientMock.prototype.startUpload).not.toHaveBeenCalled();
      });
    });

    beforeEach(() => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
        launchName: "Allure Report",
        launchTags: [],
        createLaunch: true,
      });

      plugin = new TestOpsPlugin({} as TestOpsPluginOptions);
      store = new AllureStoreMock() as unknown as AllureStore;
    });

    it("should create launch and session", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({ reportName: "Test Launch" } as PluginContext, store);

      expect(TestOpsClientMock.prototype.createLaunch).toHaveBeenCalledWith("Allure Report", []);
      expect(TestOpsClientMock.prototype.createSession).toHaveBeenCalledTimes(1);
      expect(TestOpsClientMock.prototype.createSession).toHaveBeenCalledWith(env);
    });

    it("should pass launchTags to createLaunch", async () => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
        launchName: "Custom Launch",
        launchTags: fixtures.launchTags,
        createLaunch: true,
      });

      plugin = new TestOpsPlugin({} as TestOpsPluginOptions);

      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.createLaunch).toHaveBeenCalledWith("Custom Launch", fixtures.launchTags);
    });

    it("should create direct-token upload session when called from start", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.createSession).toHaveBeenCalledWith(env);
    });

    it("should upload all test results from the store", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.uploadTestResults).toHaveBeenCalledWith(
        expect.objectContaining({
          trs: fixtures.testResults.slice(0, 1),
          environments: [],
          onProgress: expect.any(Function),
          attachmentsResolver: expect.any(Function),
          fixturesResolver: expect.any(Function),
        }),
      );
    });

    it("should map linked steps attachments before upload test results", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(1, 2));
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.uploadTestResults).toHaveBeenCalledWith(
        expect.objectContaining({
          trs: [
            {
              ...fixtures.testResults[1],
              steps: [
                {
                  ...fixtures.testResults[1].steps[0],
                  // @ts-expect-error
                  attachment: fixtures.testResults[1].steps[0].link,
                },
              ],
            },
          ],
          environments: [],
          onProgress: expect.any(Function),
          attachmentsResolver: expect.any(Function),
          fixturesResolver: expect.any(Function),
        }),
      );
    });

    it("should not upload test results when store is empty", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.createLaunch).toHaveBeenCalledTimes(1);
      expect(TestOpsClientMock.prototype.createSession).toHaveBeenCalledTimes(0);
      expect(TestOpsClientMock.prototype.uploadTestResults).toHaveBeenCalledTimes(0);
    });

    it("should call attachmentsResolver for each test result", async () => {
      AllureStoreMock.prototype.allTestResults.mockImplementation(async (options: any = {}) =>
        fixtures.testResults.filter(options.filter ?? (() => true)),
      );
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({} as PluginContext, store);

      const uploadCall = TestOpsClientMock.prototype.uploadTestResults.mock.calls[0][0];

      await uploadCall.attachmentsResolver(fixtures.testResults[0]);

      expect(AllureStoreMock.prototype.attachmentsByTrId).toHaveBeenCalledWith(fixtures.testResults[0].id);
    });

    it("should call fixturesResolver for each test result", async () => {
      AllureStoreMock.prototype.allTestResults.mockImplementation(async (options: any = {}) =>
        fixtures.testResults.filter(options.filter ?? (() => true)),
      );
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({} as PluginContext, store);

      const uploadCall = TestOpsClientMock.prototype.uploadTestResults.mock.calls[0][0];

      await uploadCall.fixturesResolver(fixtures.testResults[0]);

      expect(AllureStoreMock.prototype.fixturesByTrId).toHaveBeenCalledWith(fixtures.testResults[0].id);
    });

    it("should apply filter when uploading test results", async () => {
      const filter = (tr: any) => tr.id === "0-0-0-0";

      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
        launchName: "Allure Report",
        launchTags: [],
        createLaunch: true,
        filter,
      });

      plugin = new TestOpsPlugin({ filter } as TestOpsPluginOptions);

      AllureStoreMock.prototype.allTestResults.mockImplementation(async (options: any = {}) =>
        fixtures.testResults.filter(options.filter ?? (() => true)),
      );
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.uploadTestResults).toHaveBeenCalledWith(
        expect.objectContaining({
          trs: [fixtures.testResults[0]],
          environments: [],
          onProgress: expect.any(Function),
          attachmentsResolver: expect.any(Function),
          fixturesResolver: expect.any(Function),
        }),
      );
    });

    it("should upload global attachments when they exist", async () => {
      AllureStoreMock.prototype.allTestResults.mockImplementation(async (options: any = {}) =>
        fixtures.testResults.slice(0, 1).filter(options.filter ?? (() => true)),
      );
      AllureStoreMock.prototype.allGlobalAttachments.mockResolvedValue(fixtures.attachments);
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.uploadGlobalAttachments).toHaveBeenCalledTimes(1);
      expect(TestOpsClientMock.prototype.uploadGlobalAttachments).toHaveBeenCalledWith({
        attachments: fixtures.attachments,
        attachmentsResolver: expect.any(Function),
        onProgress: expect.any(Function),
      });
    });

    it("should not upload global attachments when they are empty", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
      AllureStoreMock.prototype.allGlobalAttachments.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.uploadGlobalAttachments).not.toHaveBeenCalled();
    });

    it("should upload global errors when they exist", async () => {
      const globalErrors = [{ message: "Something went wrong" }];

      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
      AllureStoreMock.prototype.allGlobalErrors.mockResolvedValue(globalErrors);
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.uploadGlobalErrors).toHaveBeenCalledTimes(1);
      expect(TestOpsClientMock.prototype.uploadGlobalErrors).toHaveBeenCalledWith(globalErrors, expect.any(Function));
    });

    it("should not upload global errors when they are empty", async () => {
      AllureStoreMock.prototype.allTestResults.mockImplementation(async (options: any = {}) =>
        fixtures.testResults.slice(0, 1).filter(options.filter ?? (() => true)),
      );
      AllureStoreMock.prototype.allGlobalErrors.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.uploadGlobalErrors).not.toHaveBeenCalled();
    });

    it("should call allEnvironmentIdentities from the store during upload", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
      AllureStoreMock.prototype.allEnvironmentIdentities.mockResolvedValue([
        { id: "chrome", name: "Chrome" },
        { id: "firefox", name: "Firefox" },
      ]);
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({} as PluginContext, store);

      expect(AllureStoreMock.prototype.allEnvironmentIdentities).toHaveBeenCalled();
    });

    it("should rewrite display-facing environments to environment ids only in upload payload", async () => {
      const storeFacingResult = { ...fixtures.testResults[0], environment: "QA" } as TestResult;

      AllureStoreMock.prototype.allTestResults.mockResolvedValue([storeFacingResult]);
      AllureStoreMock.prototype.allEnvironmentIdentities.mockResolvedValue([
        {
          id: "qa",
          name: "QA",
        },
      ]);
      AllureStoreMock.prototype.environmentIdByTrId.mockResolvedValue("qa");
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.uploadTestResults).toHaveBeenCalledWith(
        expect.objectContaining({
          environments: [{ id: "qa", name: "QA" }],
          trs: [expect.objectContaining({ id: storeFacingResult.id, environment: "qa" })],
        }),
      );
    });

    describe("categories", () => {
      const categoryProductErrors: CategoryDefinition = {
        id: "product-errors",
        name: "Product errors",
        matchers: [{ statuses: ["failed"] }],
        groupBy: [],
        groupByMessage: false,
        index: 0,
      };

      it("should preserve categories order from context.categories in createLaunchCategoriesBulk payload", async () => {
        const failedTr = { ...fixtures.testResults[0], status: "failed" as const };
        const brokenTr = { ...fixtures.testResults[1], status: "broken" as const };

        // Encounter order: broken first, then failed
        AllureStoreMock.prototype.allTestResults.mockResolvedValue([brokenTr, failedTr]);
        AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
        AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
        AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

        const categoryBroken: CategoryDefinition = {
          id: "test-errors",
          name: "Test errors",
          matchers: [{ statuses: ["broken"] }],
          groupBy: [],
          groupByMessage: false,
          index: 1,
        };

        TestOpsClientMock.prototype.createLaunchCategoriesBulk.mockResolvedValue([
          { id: 1, externalId: "product-errors" },
          { id: 2, externalId: "test-errors" },
        ]);

        const context = {
          // Config order: failed category first, then broken category
          categories: [categoryProductErrors, categoryBroken],
        } as PluginContext;

        await plugin.start(context, store);

        expect(TestOpsClientMock.prototype.createLaunchCategoriesBulk).toHaveBeenCalledWith(123, [
          { externalId: "product-errors", name: "Product errors" },
          { externalId: "test-errors", name: "Test errors" },
        ]);
      });

      it("should call createLaunchCategoriesBulk and attach category from context.categories when tr matches", async () => {
        const failedTr = { ...fixtures.testResults[0], status: "failed" as const };
        AllureStoreMock.prototype.allTestResults.mockResolvedValue([failedTr]);
        AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
        AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
        AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

        TestOpsClientMock.prototype.createLaunchCategoriesBulk.mockResolvedValue([
          { id: 1, externalId: "product-errors" },
        ]);

        const context = {
          categories: [{ ...categoryProductErrors, hide: false, expand: true }],
        } as PluginContext;

        await plugin.start(context, store);

        expect(TestOpsClientMock.prototype.createLaunchCategoriesBulk).toHaveBeenCalledWith(123, [
          { externalId: "product-errors", name: "Product errors", hide: false, expand: true },
        ]);
        expect(TestOpsClientMock.prototype.uploadTestResults).toHaveBeenCalledWith(
          expect.objectContaining({
            trs: [
              expect.objectContaining({
                id: failedTr.id,
                category: expect.objectContaining({
                  externalId: "product-errors",
                  name: "Product errors",
                  hide: false,
                  expand: true,
                }),
              }),
            ],
          }),
        );
      });

      it("should attach category with grouping when context.categories has groupBy", async () => {
        const categoryWithGroupBy: CategoryDefinition = {
          ...categoryProductErrors,
          id: "layer-severity",
          name: "Layer / Severity",
          groupBy: ["severity", "layer"],
          groupByMessage: true,
          groupEnvironments: true,
        };
        const failedTr = {
          ...fixtures.testResults[0],
          status: "failed" as const,
          environment: "foo",
          error: { message: "boom from testops" },
          labels: [
            { name: "severity", value: "critical" },
            { name: "layer", value: "api" },
          ],
        };
        AllureStoreMock.prototype.allTestResults.mockResolvedValue([failedTr]);
        AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
        AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
        AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

        TestOpsClientMock.prototype.createLaunchCategoriesBulk.mockResolvedValue([
          { id: 1, externalId: "layer-severity" },
        ]);

        const context = { categories: [categoryWithGroupBy] } as PluginContext;

        await plugin.start(context, store);

        expect(TestOpsClientMock.prototype.uploadTestResults).toHaveBeenCalledWith(
          expect.objectContaining({
            trs: [
              expect.objectContaining({
                category: expect.objectContaining({
                  externalId: "layer-severity",
                  name: "Layer / Severity",
                  grouping: [
                    { key: "severity", value: "critical", name: "severity: critical" },
                    { key: "layer", value: "api", name: "layer: api" },
                    {
                      key: "message",
                      value: "boom from testops",
                      name: "message: boom from testops",
                    },
                    { key: "historyId", value: failedTr.id, name: failedTr.id },
                    { key: "environment", value: "foo", name: "environment: foo" },
                  ],
                }),
              }),
            ],
          }),
        );
      });

      it("should use tr.categories when present (e.g. from awesome plugin)", async () => {
        const trWithCategories = {
          ...fixtures.testResults[0],
          categories: [
            {
              id: "product-errors",
              name: "Product errors",
              grouping: [{ key: "owner", value: "alice", name: "owner: alice" }],
              hide: false,
              expand: true,
            },
          ],
        };
        AllureStoreMock.prototype.allTestResults.mockResolvedValue([trWithCategories]);
        AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
        AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
        AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

        TestOpsClientMock.prototype.createLaunchCategoriesBulk.mockResolvedValue([
          {
            id: 2,
            externalId: "cat-1",
          },
        ]);

        await plugin.start({} as PluginContext, store);

        expect(TestOpsClientMock.prototype.createLaunchCategoriesBulk).toHaveBeenCalledWith(123, [
          { externalId: "product-errors", name: "Product errors", hide: false, expand: true },
        ]);
        expect(TestOpsClientMock.prototype.uploadTestResults).toHaveBeenCalledWith(
          expect.objectContaining({
            trs: [
              expect.objectContaining({
                category: expect.objectContaining({
                  externalId: "product-errors",
                  name: "Product errors",
                  grouping: [{ key: "owner", value: "alice", name: "owner: alice" }],
                  hide: false,
                  expand: true,
                }),
              }),
            ],
          }),
        );
      });

      it("should keep deep grouping payload from tr.categories as-is", async () => {
        const trWithDeepCategories = {
          ...fixtures.testResults[0],
          categories: [
            {
              id: "deep-cat",
              name: "Deep category",
              grouping: [
                { key: "severity", value: "critical", name: "severity: critical" },
                { key: "layer", value: "api", name: "layer: api" },
                { key: "message", value: "assert failed", name: "message: assert failed" },
                { key: "historyId", value: "hist-1", name: "my flaky test" },
                { key: "environment", value: "prod", name: "environment: prod" },
              ],
            },
          ],
        };
        AllureStoreMock.prototype.allTestResults.mockResolvedValue([trWithDeepCategories]);
        AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
        AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
        AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

        TestOpsClientMock.prototype.createLaunchCategoriesBulk.mockResolvedValue([
          {
            id: 2,
            externalId: "deep-cat",
          },
        ]);

        await plugin.start({} as PluginContext, store);

        const uploadCall = TestOpsClientMock.prototype.uploadTestResults.mock.calls[0][0];
        expect(uploadCall.trs[0].category).toEqual({
          id: 2,
          externalId: "deep-cat",
          name: "Deep category",
          grouping: [
            { key: "severity", value: "critical", name: "severity: critical" },
            { key: "layer", value: "api", name: "layer: api" },
            { key: "message", value: "assert failed", name: "message: assert failed" },
            { key: "historyId", value: "hist-1", name: "my flaky test" },
            { key: "environment", value: "prod", name: "environment: prod" },
          ],
        });
      });

      it("should include historyId but not duplicate environment when groupBy already has environment", async () => {
        const categoryWithEnvironmentGroup: CategoryDefinition = {
          ...categoryProductErrors,
          id: "env-in-group-by",
          name: "Environment first",
          groupBy: ["environment", "severity"],
          groupByMessage: true,
          groupEnvironments: true,
        };
        const failedTr = {
          ...fixtures.testResults[0],
          status: "failed" as const,
          historyId: "history-123",
          name: "broken test name",
          environment: "stage",
          error: { message: "boom" },
          labels: [{ name: "severity", value: "critical" }],
        };
        AllureStoreMock.prototype.allTestResults.mockResolvedValue([failedTr]);
        AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
        AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
        AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

        TestOpsClientMock.prototype.createLaunchCategoriesBulk.mockResolvedValue([
          { id: 1, externalId: "env-in-group-by" },
        ]);

        await plugin.start({ categories: [categoryWithEnvironmentGroup] } as PluginContext, store);

        const uploadCall = TestOpsClientMock.prototype.uploadTestResults.mock.calls[0][0];
        expect(uploadCall.trs[0].category?.grouping).toEqual([
          { key: "environment", value: "stage", name: "environment: stage" },
          { key: "severity", value: "critical", name: "severity: critical" },
          { key: "message", value: "boom", name: "message: boom" },
          { key: "historyId", value: "history-123", name: "broken test name" },
        ]);
      });

      it("should not call createLaunchCategoriesBulk when no test results have categories", async () => {
        AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
        AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
        AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
        AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

        await plugin.start({ categories: [categoryProductErrors] } as PluginContext, store);

        expect(TestOpsClientMock.prototype.createLaunchCategoriesBulk).not.toHaveBeenCalled();
        expect(TestOpsClientMock.prototype.uploadTestResults).toHaveBeenCalledWith(
          expect.objectContaining({
            trs: [expect.not.objectContaining({ category: expect.anything() })],
          }),
        );
      });

      it("should continue upload when createLaunchCategoriesBulk fails", async () => {
        const failedTr = { ...fixtures.testResults[0], status: "failed" as const };
        AllureStoreMock.prototype.allTestResults.mockResolvedValue([failedTr]);
        AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
        AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
        AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

        TestOpsClientMock.prototype.createLaunchCategoriesBulk.mockRejectedValue(new Error("Network error"));

        await plugin.start({ categories: [categoryProductErrors] } as PluginContext, store);

        expect(TestOpsClientMock.prototype.uploadTestResults).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("when client is not initialized", () => {
    it("should return early from start when client is not initialized", async () => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: "",
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
        launchName: "Allure Report",
        launchTags: [],
        createLaunch: true,
      });

      plugin = new TestOpsPlugin({} as TestOpsPluginOptions);
      store = new AllureStoreMock() as unknown as AllureStore;

      AllureStoreMock.prototype.allTestResults.mockImplementation(async (options: any = {}) =>
        fixtures.testResults.filter(options.filter ?? (() => true)),
      );
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.createLaunch).not.toHaveBeenCalled();
      expect(TestOpsClientMock.prototype.createSession).not.toHaveBeenCalled();
      expect(TestOpsClientMock.prototype.uploadTestResults).not.toHaveBeenCalled();
    });

    it("should return early from update when client is not initialized", async () => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: "",
        projectId: fixtures.projectId,
        launchName: "Allure Report",
        launchTags: [],
        createLaunch: true,
      });

      plugin = new TestOpsPlugin({} as TestOpsPluginOptions);
      store = new AllureStoreMock() as unknown as AllureStore;

      AllureStoreMock.prototype.allTestResults.mockImplementation(async (options: any = {}) =>
        fixtures.testResults.filter(options.filter ?? (() => true)),
      );

      await plugin.update({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.uploadTestResults).not.toHaveBeenCalled();
    });

    it("should return early from done when client is not initialized", async () => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: "",
        launchName: "Allure Report",
        launchTags: [],
        createLaunch: true,
      });

      plugin = new TestOpsPlugin({} as TestOpsPluginOptions);
      store = new AllureStoreMock() as unknown as AllureStore;

      AllureStoreMock.prototype.allTestResults.mockImplementation(async (options: any = {}) =>
        fixtures.testResults.filter(options.filter ?? (() => true)),
      );

      await plugin.done({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.uploadTestResults).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    beforeEach(() => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
        launchName: "Allure Report",
        launchTags: [],
        createLaunch: true,
      });

      plugin = new TestOpsPlugin({} as TestOpsPluginOptions);
      store = new AllureStoreMock() as unknown as AllureStore;
    });

    it("should create new session", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.update({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.createSession).toHaveBeenCalledTimes(1);
      expect(TestOpsClientMock.prototype.createSession).toHaveBeenCalledWith(env);
    });

    it("should upload test results", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.update({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.uploadTestResults).toHaveBeenCalledWith(
        expect.objectContaining({
          trs: fixtures.testResults.slice(0, 1),
          environments: [],
          onProgress: expect.any(Function),
          attachmentsResolver: expect.any(Function),
          fixturesResolver: expect.any(Function),
        }),
      );
    });

    it("should not re-upload test results that were already uploaded", async () => {
      AllureStoreMock.prototype.allTestResults.mockImplementation(async (options: any = {}) =>
        fixtures.testResults.slice(0, 1).filter(options.filter ?? (() => true)),
      );
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({} as PluginContext, store);

      vi.clearAllMocks();

      await plugin.update({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.createSession).toHaveBeenCalledTimes(0);
      expect(TestOpsClientMock.prototype.uploadTestResults).toHaveBeenCalledTimes(0);
    });

    it("should upload only new test results on subsequent calls", async () => {
      const firstResult = fixtures.testResults.slice(0, 1);
      const allResults = fixtures.testResults;

      AllureStoreMock.prototype.allTestResults.mockResolvedValueOnce(firstResult);
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.uploadTestResults).toHaveBeenCalledWith(
        expect.objectContaining({
          trs: expect.arrayContaining([expect.objectContaining({ id: firstResult[0].id })]),
        }),
      );

      vi.clearAllMocks();

      AllureStoreMock.prototype.allTestResults.mockResolvedValue(allResults);

      await plugin.update({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.uploadTestResults).toHaveBeenCalledWith(
        expect.objectContaining({
          trs: expect.arrayContaining([expect.objectContaining({ id: allResults[1].id })]),
        }),
      );
    });

    it("should not call createLaunch on update", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.update({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.createLaunch).toHaveBeenCalledTimes(0);
    });

    it("should apply filter when uploading test results", async () => {
      const filter = (tr: any) => tr.id === "0-0-0-1";

      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
        launchName: "Allure Report",
        launchTags: [],
        createLaunch: true,
        filter,
      });

      plugin = new TestOpsPlugin({ filter } as TestOpsPluginOptions);

      AllureStoreMock.prototype.allTestResults.mockImplementation(async (options: any = {}) =>
        fixtures.testResults.filter(options.filter ?? (() => true)),
      );
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.update({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.uploadTestResults).toHaveBeenCalledWith(
        expect.objectContaining({
          trs: [
            {
              ...fixtures.testResults[1],
              steps: [
                {
                  ...fixtures.testResults[1].steps[0],
                  // @ts-expect-error
                  attachment: fixtures.testResults[1].steps[0].link,
                },
              ],
            },
          ],
        }),
      );
    });
  });

  describe("done", () => {
    describe("ci mode", () => {
      it("should stop upload when ci is detected (non-local)", async () => {
        (detect as unknown as Mock).mockReturnValue({ type: "github" } as CiDescriptor);
        (resolvePluginOptions as Mock).mockReturnValue({
          accessToken: fixtures.accessToken,
          endpoint: fixtures.endpoint,
          projectId: fixtures.projectId,
          launchName: "Allure Report",
          launchTags: fixtures.launchTags,
          createLaunch: true,
        });

        store = new AllureStoreMock() as unknown as AllureStore;
        plugin = new TestOpsPlugin({} as TestOpsPluginOptions);

        await plugin.done({ reportUuid: "test-uuid" } as PluginContext, store);

        expect(TestOpsClientMock.prototype.stopUpload).toHaveBeenCalledTimes(1);
        expect(TestOpsClientMock.prototype.stopUpload).toHaveBeenCalledWith({ type: "github" }, "unknown");
      });
    });

    describe("outside ci mode", () => {
      it("should not stop upload when ci is local", async () => {
        (detect as unknown as Mock).mockReturnValue({ type: "local" } as CiDescriptor);
        (resolvePluginOptions as Mock).mockReturnValue({
          accessToken: fixtures.accessToken,
          endpoint: fixtures.endpoint,
          projectId: fixtures.projectId,
          launchName: "Allure Report",
          launchTags: fixtures.launchTags,
          createLaunch: true,
        });

        store = new AllureStoreMock() as unknown as AllureStore;
        plugin = new TestOpsPlugin({} as TestOpsPluginOptions);

        await plugin.done({ reportUuid: "test-uuid" } as PluginContext, store);

        expect(TestOpsClientMock.prototype.stopUpload).not.toHaveBeenCalled();
      });
    });

    beforeEach(() => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
        launchName: "Allure Report",
        launchTags: [],
        createLaunch: true,
      });

      plugin = new TestOpsPlugin({} as TestOpsPluginOptions);
      store = new AllureStoreMock() as unknown as AllureStore;
    });

    it("should create new session", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.done({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.createSession).toHaveBeenCalledTimes(1);
      expect(TestOpsClientMock.prototype.createSession).toHaveBeenCalledWith(env);
    });

    it("should upload test results", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.done({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.uploadTestResults).toHaveBeenCalledWith(
        expect.objectContaining({
          trs: fixtures.testResults.slice(0, 1),
          environments: [],
          onProgress: expect.any(Function),
          attachmentsResolver: expect.any(Function),
          fixturesResolver: expect.any(Function),
        }),
      );
    });

    it("should not call createLaunch on done", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.done({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.createLaunch).toHaveBeenCalledTimes(0);
    });

    it("should call closeLaunch when launchId is set", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      TestOpsClientMock.prototype.launchId = 123;

      await plugin.done({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.closeLaunch).toHaveBeenCalledWith(123);
    });

    it("should apply filter when uploading test results", async () => {
      const filter = (tr: any) => tr.id === "0-0-0-0";

      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
        launchName: "Allure Report",
        launchTags: [],
        createLaunch: true,
        filter,
      });

      plugin = new TestOpsPlugin({ filter } as TestOpsPluginOptions);

      AllureStoreMock.prototype.allTestResults.mockImplementation(async (options: any = {}) =>
        fixtures.testResults.filter(options.filter ?? (() => true)),
      );
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.done({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.uploadTestResults).toHaveBeenCalledWith(
        expect.objectContaining({
          trs: [fixtures.testResults[0]],
          environments: [],
          onProgress: expect.any(Function),
          attachmentsResolver: expect.any(Function),
          fixturesResolver: expect.any(Function),
        }),
      );
    });
  });

  describe("info", () => {
    beforeEach(() => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
        launchName: "Allure Report",
        launchTags: [],
        createLaunch: true,
      });

      plugin = new TestOpsPlugin({} as TestOpsPluginOptions);
      store = new AllureStoreMock() as unknown as AllureStore;
    });

    it("should return undefined when client is not initialized", async () => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: "",
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
        launchName: "Allure Report",
        launchTags: [],
        createLaunch: true,
      });

      plugin = new TestOpsPlugin({} as TestOpsPluginOptions);
      const result = await plugin.info({} as PluginContext, store);

      expect(result).toBeUndefined();
    });

    it("should return undefined when launchUrl is not available", async () => {
      TestOpsClientMock.prototype.launchUrl = undefined;

      const result = await plugin.info({} as PluginContext, store);

      expect(result).toBeUndefined();
    });

    it("should return plugin summary with correct remoteHref", async () => {
      TestOpsClientMock.prototype.launchUrl = fixtures.launchUrl;
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults);
      AllureStoreMock.prototype.allNewTestResults.mockResolvedValue([]);
      AllureStoreMock.prototype.testsStatistic.mockResolvedValue({
        total: 2,
        passed: 1,
        failed: 1,
      });

      const result = await plugin.info({} as PluginContext, store);

      expect(result).toBeDefined();
      expect(result?.remoteHref).toBe(fixtures.launchUrl);
    });

    it("should apply filter when provided in options", async () => {
      const filter = (tr: any) => tr.id === "0-0-0-0";

      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
        launchName: "Allure Report",
        launchTags: [],
        createLaunch: true,
        filter,
      });

      plugin = new TestOpsPlugin({ filter } as TestOpsPluginOptions);

      TestOpsClientMock.prototype.launchUrl = fixtures.launchUrl;
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults);
      AllureStoreMock.prototype.allNewTestResults.mockResolvedValue([]);
      AllureStoreMock.prototype.testsStatistic.mockResolvedValue({
        total: 1,
        passed: 1,
        failed: 0,
      });

      await plugin.info({} as PluginContext, store);

      expect(AllureStoreMock.prototype.testsStatistic).toHaveBeenCalledWith(filter);
    });
  });

  describe("publish", () => {
    beforeEach(() => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
        launchName: "Allure Report",
        launchTags: [],
        createLaunch: true,
        publish: true,
      });
      plugin = new TestOpsPlugin({} as TestOpsPluginOptions);
      AllureTestOpsClientMock.prototype.createReport.mockResolvedValue(undefined);
      AllureTestOpsClientMock.prototype.addReportFile.mockResolvedValue("http://example.com/report/index.html");
      AllureTestOpsClientMock.prototype.addReportAsset.mockResolvedValue(undefined);
      AllureTestOpsClientMock.prototype.deleteReport.mockResolvedValue(undefined);
      AllureTestOpsClientMock.prototype.completeReport.mockResolvedValue(undefined);
    });

    it("should return undefined when plugin is disabled", async () => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: "",
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
        launchName: "Allure Report",
        launchTags: [],
        createLaunch: true,
        publish: true,
      });
      plugin = new TestOpsPlugin({} as TestOpsPluginOptions);

      const result = await plugin.publish({
        reportUuid: "r-1",
        reportName: "Report",
        reports: [
          {
            pluginId: "awesome",
            publish: true,
            files: {
              "index.html": "/tmp/index.html",
            },
          },
        ],
      });

      expect(result).toBeUndefined();
    });

    it("should skip launch creation/upload by default and still publish report", async () => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
        launchName: "Allure Report",
        launchTags: [],
        publish: true,
      });
      plugin = new TestOpsPlugin({} as TestOpsPluginOptions);

      store = new AllureStoreMock() as unknown as AllureStore;
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));

      await plugin.start({ reportUuid: "test-uuid" } as PluginContext, store);

      expect(TestOpsClientMock.prototype.createLaunch).not.toHaveBeenCalled();
      expect(TestOpsClientMock.prototype.createSession).not.toHaveBeenCalled();
      expect(TestOpsClientMock.prototype.uploadTestResults).not.toHaveBeenCalled();

      const result = await plugin.publish({
        reportUuid: "r-1",
        reportName: "Report",
        reports: [
          {
            pluginId: "awesome",
            publish: true,
            files: {
              "index.html": "/tmp/index.html",
            },
          },
        ],
      });

      expect(AllureTestOpsClientMock.prototype.createReport).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        linksByPluginId: {
          awesome: "http://example.com/report/index.html",
        },
        remoteHref: "http://example.com/report/index.html",
      });
    });

    it("should return undefined when no published report files are available", async () => {
      const result = await plugin.publish({
        reportUuid: "r-1",
        reportName: "Report",
        reports: [
          {
            pluginId: "awesome",
            publish: false,
            files: {
              "index.html": "/tmp/index.html",
            },
          },
        ],
      });

      expect(result).toBeUndefined();
      expect(AllureTestOpsClientMock).not.toHaveBeenCalled();
      expect(AllureTestOpsClientMock.prototype.createReport).not.toHaveBeenCalled();
    });

    it("should create, upload and complete report", async () => {
      const result = await plugin.publish({
        reportUuid: "r-1",
        reportName: "Report",
        reports: [
          {
            pluginId: "awesome",
            publish: true,
            files: {
              "index.html": "/tmp/index.html",
              "widgets/summary.json": "/tmp/widgets-summary.json",
              "app.js": "/tmp/app.js",
            },
          },
        ],
      });

      expect(AllureTestOpsClientMock.prototype.createReport).toHaveBeenCalledWith({
        reportUuid: "r-1",
        reportName: "Report",
      });
      expect(AllureTestOpsClientMock).toHaveBeenCalledWith({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
      });
      expect(AllureTestOpsClientMock.prototype.addReportFile).toHaveBeenCalledTimes(2);
      expect(AllureTestOpsClientMock.prototype.addReportAsset).toHaveBeenCalledWith({
        filename: "app.js",
        filepath: "/tmp/app.js",
        signal: expect.any(AbortSignal),
      });
      expect(AllureTestOpsClientMock.prototype.completeReport).toHaveBeenCalled();
      expect(result).toEqual({
        linksByPluginId: {
          awesome: "http://example.com/report/index.html",
        },
        remoteHref: "http://example.com/report/index.html",
      });
    });

    it("should show report upload progress for every uploaded report file", async () => {
      const progressBar = {
        tick: vi.fn(),
        update: vi.fn(),
        terminate: vi.fn(),
      };
      const progressBarCounter = vi.spyOn(Logger.prototype, "progressBarCounter").mockReturnValue(progressBar);

      try {
        await plugin.publish({
          reportUuid: "r-1",
          reportName: "Report",
          reports: [
            {
              pluginId: "awesome",
              publish: true,
              files: {
                "index.html": "/tmp/index.html",
                "widgets/summary.json": "/tmp/widgets-summary.json",
                "app.js": "/tmp/app.js",
              },
            },
          ],
          summary: {
            filepath: "/tmp/summary-index.html",
          },
        });

        expect(progressBarCounter).toHaveBeenCalledWith('Publishing "awesome" report', 3);
        expect(progressBar.tick).toHaveBeenCalledTimes(3);
        expect(progressBar.terminate).toHaveBeenCalledTimes(1);
      } finally {
        progressBarCounter.mockRestore();
      }
    });

    it("should upload report files in parallel with a concurrency limit", async () => {
      const progressBar = {
        tick: vi.fn(),
        update: vi.fn(),
        terminate: vi.fn(),
      };
      const progressBarCounter = vi.spyOn(Logger.prototype, "progressBarCounter").mockReturnValue(progressBar);
      const firstBatchStarted = createDeferred();
      const fileCount = 55;
      const fileResolvers: (() => void)[] = [];
      let activeUploads = 0;
      let maxActiveUploads = 0;
      let startedUploads = 0;

      AllureTestOpsClientMock.prototype.addReportFile.mockImplementation(({ filename }: { filename: string }) => {
        activeUploads++;
        startedUploads++;
        maxActiveUploads = Math.max(maxActiveUploads, activeUploads);

        if (startedUploads === 50) {
          firstBatchStarted.resolve();
        }

        return new Promise((resolve) => {
          fileResolvers.push(() => {
            activeUploads--;
            resolve(`http://example.com/report/${filename}`);
          });
        });
      });

      const files = Object.fromEntries([
        ["index.html", "/tmp/index.html"],
        ...Array.from({ length: fileCount - 1 }, (_, index) => [
          `data/file-${index}.json`,
          `/tmp/data-file-${index}.json`,
        ]),
      ]);

      try {
        const publishPromise = plugin.publish({
          reportUuid: "r-1",
          reportName: "Report",
          reports: [
            {
              pluginId: "awesome",
              publish: true,
              files,
            },
          ],
        });

        await firstBatchStarted.promise;

        expect(startedUploads).toBe(50);
        expect(maxActiveUploads).toBe(50);

        while (startedUploads < fileCount || activeUploads > 0) {
          const batch = fileResolvers.splice(0);

          batch.forEach((resolve) => resolve());
          await Promise.resolve();
          await Promise.resolve();
        }

        await publishPromise;

        expect(startedUploads).toBe(fileCount);
        expect(maxActiveUploads).toBe(50);
        expect(progressBarCounter).toHaveBeenCalledWith('Publishing "awesome" report', fileCount);
        expect(progressBar.tick).toHaveBeenCalledTimes(fileCount);
        expect(progressBar.terminate).toHaveBeenCalledTimes(1);
      } finally {
        progressBarCounter.mockRestore();
      }
    });

    it("should retry transient report upload failure and tick progress once", async () => {
      const progressBar = {
        tick: vi.fn(),
        update: vi.fn(),
        terminate: vi.fn(),
      };
      const progressBarCounter = vi.spyOn(Logger.prototype, "progressBarCounter").mockReturnValue(progressBar);

      AllureTestOpsClientMock.prototype.addReportFile
        .mockRejectedValueOnce(new Error("transient"))
        .mockResolvedValueOnce("http://example.com/report/index.html");

      try {
        const result = await plugin.publish({
          reportUuid: "r-1",
          reportName: "Report",
          reports: [
            {
              pluginId: "awesome",
              publish: true,
              files: {
                "index.html": "/tmp/index.html",
              },
            },
          ],
        });

        expect(result?.remoteHref).toBe("http://example.com/report/index.html");
        expect(AllureTestOpsClientMock.prototype.addReportFile).toHaveBeenCalledTimes(2);
        expect(AllureTestOpsClientMock.prototype.deleteReport).not.toHaveBeenCalled();
        expect(AllureTestOpsClientMock.prototype.completeReport).toHaveBeenCalledTimes(1);
        expect(progressBar.tick).toHaveBeenCalledTimes(1);
        expect(progressBar.terminate).toHaveBeenCalledTimes(1);
      } finally {
        progressBarCounter.mockRestore();
      }
    });

    it("should retry permanent report upload failure, abort pending uploads, delete report and not complete", async () => {
      const progressBar = {
        tick: vi.fn(),
        update: vi.fn(),
        terminate: vi.fn(),
      };
      const progressBarCounter = vi.spyOn(Logger.prototype, "progressBarCounter").mockReturnValue(progressBar);
      const events: string[] = [];
      const uploadSignals: (AbortSignal | undefined)[] = [];
      const addReportFileMock = AllureTestOpsClientMock.prototype.addReportFile as Mock;
      const addReportAssetMock = AllureTestOpsClientMock.prototype.addReportAsset as Mock;
      const deleteReportMock = AllureTestOpsClientMock.prototype.deleteReport as Mock;
      let rejectFailedUpload!: (reason: unknown) => void;
      const failedUpload = new Promise<never>((_, reject) => {
        rejectFailedUpload = reject;
      });
      const waitForAbort = (filename: string, signal?: AbortSignal) =>
        new Promise<never>((_, reject) => {
          const abortError = new Error("upload aborted");

          abortError.name = "AbortError";

          if (signal?.aborted) {
            events.push(`abort:${filename}`);
            reject(abortError);
          } else if (signal) {
            signal.addEventListener(
              "abort",
              () => {
                events.push(`abort:${filename}`);
                reject(abortError);
              },
              { once: true },
            );
          }
        });
      addReportFileMock.mockImplementation(({ filename, signal }: { filename: string; signal?: AbortSignal }) => {
        events.push(`upload:${filename}`);
        uploadSignals.push(signal);

        if (filename === "data/failing.json") {
          return failedUpload;
        }

        return waitForAbort(filename, signal);
      });
      addReportAssetMock.mockImplementation(({ filename, signal }: { filename: string; signal?: AbortSignal }) => {
        events.push(`upload:${filename}`);
        uploadSignals.push(signal);

        return waitForAbort(filename, signal);
      });
      deleteReportMock.mockImplementation(async () => {
        events.push("delete");

        return undefined;
      });

      try {
        const publishPromise = plugin.publish({
          reportUuid: "r-1",
          reportName: "Report",
          reports: [
            {
              pluginId: "awesome",
              publish: true,
              files: {
                "index.html": "/tmp/index.html",
                "data/failing.json": "/tmp/failing.json",
                "widgets/pending.json": "/tmp/pending.json",
                "assets/app.css": "/tmp/app.css",
              },
            },
          ],
        });

        await vi.waitFor(() => {
          expect(addReportFileMock).toBeCalledTimes(3);
          expect(addReportAssetMock).toBeCalledTimes(1);
        });

        rejectFailedUpload(new Error("upload failed"));
        const result = await publishPromise;

        const deleteIndex = events.indexOf("delete");

        expect(progressBarCounter).toHaveBeenCalledWith('Publishing "awesome" report', 4);
        expect(result).toBeUndefined();
        expect(deleteIndex).toBeGreaterThan(-1);
        expect(new Set(uploadSignals).size).toBe(1);
        expect(uploadSignals.every((signal) => signal?.aborted)).toBe(true);
        for (const filename of ["index.html", "widgets/pending.json", "assets/app.css"]) {
          const abortIndex = events.indexOf(`abort:${filename}`);

          expect(abortIndex).toBeGreaterThan(-1);
          expect(abortIndex).toBeLessThan(deleteIndex);
        }
        expect(
          addReportFileMock.mock.calls.filter(([payload]) => payload.filename === "data/failing.json"),
        ).toHaveLength(5);
        expect(deleteReportMock).toBeCalledWith({ reportUuid: "r-1" });
        expect(progressBar.tick).not.toHaveBeenCalled();
        expect(progressBar.terminate).toHaveBeenCalledTimes(1);
        expect(AllureTestOpsClientMock.prototype.completeReport).not.toHaveBeenCalled();
      } finally {
        progressBarCounter.mockRestore();
      }
    });

    it("should delete whole report and not complete when a later plugin fails", async () => {
      (AllureTestOpsClientMock.prototype.addReportFile as Mock).mockImplementation(
        ({ pluginId, filename }: { pluginId?: string; filename: string }) => {
          if (pluginId === "failed") {
            throw new Error("boom");
          }

          return pluginId
            ? `http://example.com/report/${pluginId}/${filename}`
            : "http://example.com/report/index.html";
        },
      );

      const result = await plugin.publish({
        reportUuid: "r-1",
        reportName: "Report",
        reports: [
          {
            pluginId: "awesome",
            publish: true,
            files: {
              "index.html": "/tmp/awesome-index.html",
            },
          },
          {
            pluginId: "failed",
            publish: true,
            files: {
              "index.html": "/tmp/failed-index.html",
            },
          },
        ],
      });

      expect(AllureTestOpsClientMock.prototype.deleteReport).toHaveBeenCalledWith({
        reportUuid: "r-1",
      });
      expect(
        AllureTestOpsClientMock.prototype.addReportFile.mock.calls.filter(([payload]) => payload.pluginId === "failed"),
      ).toHaveLength(5);
      expect(AllureTestOpsClientMock.prototype.completeReport).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("should upload root summary when provided", async () => {
      AllureTestOpsClientMock.prototype.addReportFile.mockImplementation(
        ({ filename, pluginId }: { filename: string; pluginId?: string }) =>
          pluginId ? `http://example.com/report/${pluginId}/${filename}` : `http://example.com/report/${filename}`,
      );

      const result = await plugin.publish({
        reportUuid: "r-1",
        reportName: "Report",
        reports: [
          {
            pluginId: "awesome",
            publish: true,
            files: {
              "index.html": "/tmp/awesome-index.html",
            },
          },
        ],
        summary: {
          filepath: "/tmp/summary-index.html",
        },
      });

      expect(AllureTestOpsClientMock.prototype.addReportFile).toHaveBeenCalledWith({
        reportUuid: "r-1",
        filename: "index.html",
        filepath: "/tmp/summary-index.html",
      });
      expect(result).toEqual({
        linksByPluginId: {
          awesome: "http://example.com/report/awesome/index.html",
        },
        remoteHref: "http://example.com/report/index.html",
      });
    });
  });
});
