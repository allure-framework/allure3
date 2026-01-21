import type { AttachmentLink, TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext } from "@allurereport/plugin-api";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TestopsUploaderPluginOptions } from "../src/model.js";
import { TestopsUploaderPlugin } from "../src/plugin.js";
import { resolvePluginOptions } from "../src/utils.js";
import { AllureStoreMock, TestOpsClientMock } from "./utils.js";

vi.mock("../src/client.js", async () => {
  const utils = await import("./utils.js");

  return {
    TestOpsClient: utils.TestOpsClientMock,
  };
});
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
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("testops plugin", () => {
  describe("constructor", () => {
    it("should call resolvePluginOptions with provided options", () => {
      (resolvePluginOptions as Mock).mockReturnValue({});

      const options = {
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
      } as TestopsUploaderPluginOptions;

      new TestopsUploaderPlugin(options);

      expect(resolvePluginOptions).toHaveBeenCalledWith(options);
    });

    it("should not initialize client when accessToken is missing", () => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: "",
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
        launchName: "Allure Report",
        launchTags: [],
      });

      const plugin = new TestopsUploaderPlugin({} as TestopsUploaderPluginOptions);

      expect(plugin).toBeInstanceOf(TestopsUploaderPlugin);
      expect(TestOpsClientMock).not.toHaveBeenCalled();
    });

    it("should not initialize client when endpoint is missing", () => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: "",
        projectId: fixtures.projectId,
        launchName: "Allure Report",
        launchTags: [],
      });

      const plugin = new TestopsUploaderPlugin({} as TestopsUploaderPluginOptions);

      expect(plugin).toBeInstanceOf(TestopsUploaderPlugin);
      expect(TestOpsClientMock).not.toHaveBeenCalled();
    });

    it("should not initialize client when projectId is missing", () => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: "",
        launchName: "Allure Report",
        launchTags: [],
      });

      const plugin = new TestopsUploaderPlugin({} as TestopsUploaderPluginOptions);

      expect(plugin).toBeInstanceOf(TestopsUploaderPlugin);
      expect(TestOpsClientMock).not.toHaveBeenCalled();
    });

    it("should create a new instance and initialize testops client with the resolved options", () => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
        launchName: "Allure Report",
        launchTags: [],
      });

      const plugin = new TestopsUploaderPlugin({} as TestopsUploaderPluginOptions);

      expect(plugin).toBeInstanceOf(TestopsUploaderPlugin);
      expect(TestOpsClientMock).toHaveBeenCalledWith({
        baseUrl: fixtures.endpoint,
        accessToken: fixtures.accessToken,
        projectId: fixtures.projectId,
      });
    });
  });

  describe("start", () => {
    let plugin: TestopsUploaderPlugin;
    let store: AllureStore;

    beforeEach(() => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
        launchName: "Allure Report",
        launchTags: [],
      });

      plugin = new TestopsUploaderPlugin({} as TestopsUploaderPluginOptions);
      store = new AllureStoreMock() as unknown as AllureStore;
    });

    it("should issue oauth token, create launch and session", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({ reportName: "Test Launch" } as PluginContext, store);

      expect(TestOpsClientMock.prototype.issueOauthToken).toHaveBeenCalledTimes(1);
      expect(TestOpsClientMock.prototype.createLaunch).toHaveBeenCalledWith("Allure Report", []);
      expect(TestOpsClientMock.prototype.createSession).toHaveBeenCalledTimes(1);
    });

    it("should pass launchTags to createLaunch", async () => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
        launchName: "Custom Launch",
        launchTags: fixtures.launchTags,
      });

      const pluginWithTags = new TestopsUploaderPlugin({} as TestopsUploaderPluginOptions);
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await pluginWithTags.start({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.createLaunch).toHaveBeenCalledWith("Custom Launch", fixtures.launchTags);
    });

    it("should not issue oauth token again in upload when called from start", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.issueOauthToken).toHaveBeenCalledTimes(1);
    });

    it("should upload all test results from the store", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.uploadTestResults).toHaveBeenCalledWith({
        trs: fixtures.testResults.slice(0, 1),
        attachmentsResolver: expect.any(Function),
        fixturesResolver: expect.any(Function),
      });
    });

    it("should map linked steps attachments before upload test results", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(1, 2));
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.uploadTestResults).toHaveBeenCalledWith({
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
        attachmentsResolver: expect.any(Function),
        fixturesResolver: expect.any(Function),
      });
    });

    it("should not upload test results when store is empty", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.issueOauthToken).toHaveBeenCalledTimes(1);
      expect(TestOpsClientMock.prototype.createLaunch).toHaveBeenCalledTimes(1);
      expect(TestOpsClientMock.prototype.createSession).toHaveBeenCalledTimes(0);
      expect(TestOpsClientMock.prototype.uploadTestResults).toHaveBeenCalledTimes(0);
    });

    it("should call attachmentsResolver for each test result", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults);
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({} as PluginContext, store);

      const uploadCall = TestOpsClientMock.prototype.uploadTestResults.mock.calls[0][0];

      await uploadCall.attachmentsResolver(fixtures.testResults[0]);

      expect(AllureStoreMock.prototype.attachmentsByTrId).toHaveBeenCalledWith(fixtures.testResults[0].id);
    });

    it("should call fixturesResolver for each test result", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults);
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({} as PluginContext, store);

      const uploadCall = TestOpsClientMock.prototype.uploadTestResults.mock.calls[0][0];

      await uploadCall.fixturesResolver(fixtures.testResults[0]);

      expect(AllureStoreMock.prototype.fixturesByTrId).toHaveBeenCalledWith(fixtures.testResults[0].id);
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
      });

      const plugin = new TestopsUploaderPlugin({} as TestopsUploaderPluginOptions);
      const store = new AllureStoreMock() as unknown as AllureStore;

      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults);
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.issueOauthToken).not.toHaveBeenCalled();
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
      });

      const plugin = new TestopsUploaderPlugin({} as TestopsUploaderPluginOptions);
      const store = new AllureStoreMock() as unknown as AllureStore;

      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults);

      await plugin.update({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.issueOauthToken).not.toHaveBeenCalled();
      expect(TestOpsClientMock.prototype.uploadTestResults).not.toHaveBeenCalled();
    });

    it("should return early from done when client is not initialized", async () => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: "",
        launchName: "Allure Report",
        launchTags: [],
      });

      const plugin = new TestopsUploaderPlugin({} as TestopsUploaderPluginOptions);
      const store = new AllureStoreMock() as unknown as AllureStore;

      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults);

      await plugin.done({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.issueOauthToken).not.toHaveBeenCalled();
      expect(TestOpsClientMock.prototype.uploadTestResults).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    let plugin: TestopsUploaderPlugin;
    let store: AllureStore;

    beforeEach(() => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
        launchName: "Allure Report",
        launchTags: [],
      });

      plugin = new TestopsUploaderPlugin({} as TestopsUploaderPluginOptions);
      store = new AllureStoreMock() as unknown as AllureStore;
    });

    it("should issue new oauth token and create new session", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.update({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.issueOauthToken).toHaveBeenCalledTimes(1);
      expect(TestOpsClientMock.prototype.createSession).toHaveBeenCalledTimes(1);
    });

    it("should upload test results", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.update({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.uploadTestResults).toHaveBeenCalledWith({
        trs: fixtures.testResults.slice(0, 1),
        attachmentsResolver: expect.any(Function),
        fixturesResolver: expect.any(Function),
      });
    });

    it("should not re-upload test results that were already uploaded", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.start({} as PluginContext, store);

      vi.clearAllMocks();

      await plugin.update({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.issueOauthToken).toHaveBeenCalledTimes(0);
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
  });

  describe("done", () => {
    let plugin: TestopsUploaderPlugin;
    let store: AllureStore;

    beforeEach(() => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
        launchName: "Allure Report",
        launchTags: [],
      });

      plugin = new TestopsUploaderPlugin({} as TestopsUploaderPluginOptions);
      store = new AllureStoreMock() as unknown as AllureStore;
    });

    it("should issue new oauth token and create new session", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.done({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.issueOauthToken).toHaveBeenCalledTimes(1);
      expect(TestOpsClientMock.prototype.createSession).toHaveBeenCalledTimes(1);
    });

    it("should upload test results", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.done({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.uploadTestResults).toHaveBeenCalledWith({
        trs: fixtures.testResults.slice(0, 1),
        attachmentsResolver: expect.any(Function),
        fixturesResolver: expect.any(Function),
      });
    });

    it("should not call createLaunch on done", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(0, 1));
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.done({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.createLaunch).toHaveBeenCalledTimes(0);
    });
  });
});
