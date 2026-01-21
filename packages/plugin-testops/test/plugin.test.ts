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

    it("shouldn't create the class when options can't be resolved without errors", () => {
      (resolvePluginOptions as Mock).mockImplementation(() => {
        throw new Error("test");
      });

      expect(() => new TestopsUploaderPlugin({} as TestopsUploaderPluginOptions)).toThrow("test");
    });

    it("should create a new instance and initialize testops client with the resolved options", () => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
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
      expect(TestOpsClientMock.prototype.createLaunch).toHaveBeenCalledWith("Test Launch");
      expect(TestOpsClientMock.prototype.createSession).toHaveBeenCalledTimes(1);
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
  });

  describe("update", () => {
    let plugin: TestopsUploaderPlugin;
    let store: AllureStore;

    beforeEach(() => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
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
  });

  describe("done", () => {
    let plugin: TestopsUploaderPlugin;
    let store: AllureStore;

    beforeEach(() => {
      (resolvePluginOptions as Mock).mockReturnValue({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
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
  });
});
