import type { AttachmentLink, TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext } from "@allurereport/plugin-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TestopsUploaderPluginOptions } from "../src/model.js";
import { TestopsUploaderPlugin } from "../src/plugin.js";
import { AllureStoreMock, TestOpsClientMock } from "./utils.js";

vi.mock("../src/client.js", async () => {
  const utils = await import("./utils.js");

  return {
    TestOpsClient: utils.TestOpsClientMock,
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
    it("should throw an error if options don't contain accessToken", () => {
      expect(() => new TestopsUploaderPlugin({} as TestopsUploaderPluginOptions)).toThrow();
    });

    it("should throw an error if options don't contain endpoint", () => {
      expect(
        () =>
          new TestopsUploaderPlugin({
            accessToken: fixtures.accessToken,
          } as TestopsUploaderPluginOptions),
      ).toThrow();
    });

    it("should throw an error if options don't contain projectId", () => {
      expect(
        () =>
          new TestopsUploaderPlugin({
            accessToken: fixtures.accessToken,
            endpoint: fixtures.endpoint,
          } as TestopsUploaderPluginOptions),
      ).toThrow();
    });

    it("should create a new instance when all options are provided", () => {
      const plugin = new TestopsUploaderPlugin({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
      } as TestopsUploaderPluginOptions);

      expect(plugin).toBeInstanceOf(TestopsUploaderPlugin);
    });
  });

  describe("done", () => {
    let plugin: TestopsUploaderPlugin;
    let store: AllureStore;

    beforeEach(() => {
      plugin = new TestopsUploaderPlugin({
        accessToken: fixtures.accessToken,
        endpoint: fixtures.endpoint,
        projectId: fixtures.projectId,
      } as TestopsUploaderPluginOptions);
      store = new AllureStoreMock() as unknown as AllureStore;
    });

    it("should initialize the testops client", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.done({} as PluginContext, store);

      expect(TestOpsClientMock.prototype.initialize).toHaveBeenCalled();
    });

    it("should upload all test results from the store", async () => {
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

    it("should map linked steps attachments before upload test results", async () => {
      AllureStoreMock.prototype.allTestResults.mockResolvedValue(fixtures.testResults.slice(1, 2));
      AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
      AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
      AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

      await plugin.done({} as PluginContext, store);

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
});
