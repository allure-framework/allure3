import type { AttachmentLink, TestResult, TestStepResult } from "@allurereport/core-api";
import FormData from "form-data";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TestOpsClient } from "../src/client.js";
import type { TestOpsLaunch } from "../src/model.js";
import { AxiosMock } from "./utils.js";

const fixtures = {
  accessToken: "test",
  ouathToken: "tset",
  endpoint: "http://example.com",
  projectId: "12345",
  launch: {
    id: 123,
  } as TestOpsLaunch,
  launchName: "Test Launch",
  testResults: [
    {
      id: "0-0-0-0",
    } as TestResult,
    {
      id: "1-1-1-1",
    } as TestResult,
    {
      id: "2-2-2-2",
    } as TestResult,
  ],
  testOpsResults: [
    {
      id: 1,
      uuid: "0-0-0-0",
    },
    {
      id: 2,
      uuid: "1-1-1-1",
    },
    {
      id: 3,
      uuid: "2-2-2-2",
    },
  ],
  attachments: [
    {
      originalFileName: "test.txt",
      contentType: "text/plain",
    } as AttachmentLink,
  ],
  // TODO:
  fixtures: [
    {
      name: "before hook",
    } as TestStepResult,
    {
      name: "after hook",
    } as TestStepResult,
  ],
};

vi.mock("axios", async () => {
  const utils = await import("./utils.js");

  return {
    default: {
      create: () => utils.AxiosMock,
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("testops http client", () => {
  describe("constructor", () => {
    it("should throw an error when accessToken is not provided", () => {
      expect(
        () => new TestOpsClient({ accessToken: "", projectId: fixtures.projectId, baseUrl: fixtures.endpoint }),
      ).toThrow();
    });

    it("should throw an error when projectId is not provided", () => {
      expect(
        () => new TestOpsClient({ accessToken: fixtures.accessToken, projectId: "", baseUrl: fixtures.endpoint }),
      ).toThrow();
    });

    it("should throw an error when baseUrl is not provided", () => {
      expect(
        () => new TestOpsClient({ accessToken: fixtures.accessToken, projectId: fixtures.projectId, baseUrl: "" }),
      ).toThrow();
    });
  });

  describe("launchUrl", () => {
    it("should return undefined when launch is not created", () => {
      const client = new TestOpsClient({
        accessToken: fixtures.accessToken,
        projectId: fixtures.projectId,
        baseUrl: fixtures.endpoint,
      });

      expect(client.launchUrl).toBeUndefined();
    });

    it("should return launch url when launch is created", async () => {
      AxiosMock.post.mockImplementation((url: string) => {
        if (url === "/api/launch") {
          return Promise.resolve({ data: fixtures.launch });
        }

        return Promise.resolve({ data: {} });
      });

      const client = new TestOpsClient({
        accessToken: fixtures.accessToken,
        projectId: fixtures.projectId,
        baseUrl: fixtures.endpoint,
      });

      await client.initialize(fixtures.launchName);

      expect(client.launchUrl).toBe(`${BASE_URL}/launch/${fixtures.launch.id}`);
    });
  });

  describe("createLaunch", () => {
    it("should create launch with issues oauth token", async () => {
      AxiosMock.post.mockImplementation((url: string) => {
        if (url === "/api/uaa/oauth/token") {
          return Promise.resolve({ data: { access_token: fixtures.ouathToken } });
        }

        return Promise.resolve({ data: {} });
      });

      const client = new TestOpsClient({
        accessToken: fixtures.accessToken,
        projectId: fixtures.projectId,
        baseUrl: fixtures.endpoint,
      });

      await client.issueOauthToken();
      await client.createLaunch(fixtures.launchName);

      expect(AxiosMock.post).toHaveBeenCalledTimes(2);
      expect(AxiosMock.post).toHaveBeenNthCalledWith(1, "/api/uaa/oauth/token", expect.anything());
      expect(AxiosMock.post).toHaveBeenNthCalledWith(
        2,
        "/api/launch",
        {
          name: fixtures.launchName,
          projectId: fixtures.projectId,
          autoclose: true,
          external: true,
        },
        {
          headers: {
            Authorization: `Bearer ${fixtures.ouathToken}`,
          },
        },
      );
    });
  });

  describe("createSession", () => {
    it("should throw an error when lauch hasn't been created before", async () => {
      const client = new TestOpsClient({
        accessToken: fixtures.accessToken,
        projectId: fixtures.projectId,
        baseUrl: fixtures.endpoint,
      });

      expect(async () => await client.createSession()).rejects.toThrow();
      expect(AxiosMock.post).toHaveBeenCalledTimes(0);
    });

    it("should create a session for a current launch", async () => {
      AxiosMock.post.mockImplementation((url: string) => {
        if (url === "/api/uaa/oauth/token") {
          return Promise.resolve({ data: { access_token: fixtures.ouathToken } });
        }

        if (url === "/api/launch") {
          return Promise.resolve({ data: fixtures.launch });
        }

        return Promise.resolve({ data: {} });
      });

      const client = new TestOpsClient({
        accessToken: fixtures.accessToken,
        projectId: fixtures.projectId,
        baseUrl: fixtures.endpoint,
      });

      await client.issueOauthToken();
      await client.createLaunch(fixtures.launchName);
      await client.createSession();

      expect(AxiosMock.post).toHaveBeenCalledTimes(3);
      expect(AxiosMock.post).toHaveBeenNthCalledWith(1, "/api/uaa/oauth/token", expect.anything());
      expect(AxiosMock.post).toHaveBeenNthCalledWith(2, "/api/launch", expect.anything(), expect.anything());
      expect(AxiosMock.post).toHaveBeenNthCalledWith(
        3,
        "/api/rs/upload/session?manual=true",
        {
          launchId: fixtures.launch.id,
        },
        {
          headers: {
            Authorization: `Bearer ${fixtures.ouathToken}`,
          },
        },
      );
    });
  });

  describe("uploadTestResults", () => {
    it("should throw an error when session hasn't been initialized before", async () => {
      const client = new TestOpsClient({
        accessToken: fixtures.accessToken,
        projectId: fixtures.projectId,
        baseUrl: fixtures.endpoint,
      });

      expect(
        async () =>
          await client.uploadTestResults({
            trs: [],
            attachmentsResolver: () => Promise.resolve([]),
            fixturesResolver: () => Promise.resolve([]),
          }),
      ).rejects.toThrow();
      expect(AxiosMock.post).toHaveBeenCalledTimes(0);
    });

    it("should resolve attachments and upload them", async () => {
      AxiosMock.post.mockImplementation((url: string) => {
        if (url === "/api/uaa/oauth/token") {
          return Promise.resolve({ data: { access_token: fixtures.ouathToken } });
        }

        if (url === "/api/launch") {
          return Promise.resolve({ data: fixtures.launch });
        }

        if (url === "/api/upload/test-result") {
          return Promise.resolve({
            data: {
              results: fixtures.testOpsResults,
            },
          });
        }

        return Promise.resolve({ data: {} });
      });

      const client = new TestOpsClient({
        accessToken: fixtures.accessToken,
        projectId: fixtures.projectId,
        baseUrl: fixtures.endpoint,
      });
      const attachmentsResolver = vi.fn().mockImplementation(async (tr) => {
        if (tr.id === fixtures.testResults[0].id) {
          return fixtures.attachments;
        }

        return [];
      });

      await client.initialize(fixtures.launchName);
      await client.uploadTestResults({
        trs: fixtures.testResults,
        attachmentsResolver,
        fixturesResolver: () => Promise.resolve([]),
      });

      expect(attachmentsResolver).toHaveBeenCalledTimes(fixtures.testResults.length);
      expect(attachmentsResolver).toHaveBeenNthCalledWith(1, fixtures.testResults[0]);
      expect(attachmentsResolver).toHaveBeenNthCalledWith(2, fixtures.testResults[1]);
      expect(attachmentsResolver).toHaveBeenNthCalledWith(3, fixtures.testResults[2]);
      expect(AxiosMock.post).toHaveBeenCalledWith(
        `/api/upload/test-result/${fixtures.testOpsResults[0].id}/attachment`,
        expect.any(FormData),
        expect.anything(),
      );
    });

    it("should resolve fixtures and upload them", async () => {
      AxiosMock.post.mockImplementation((url: string) => {
        if (url === "/api/uaa/oauth/token") {
          return Promise.resolve({ data: { access_token: fixtures.ouathToken } });
        }

        if (url === "/api/launch") {
          return Promise.resolve({ data: fixtures.launch });
        }

        if (url === "/api/upload/test-result") {
          return Promise.resolve({
            data: {
              results: fixtures.testOpsResults,
            },
          });
        }

        return Promise.resolve({ data: {} });
      });

      const client = new TestOpsClient({
        accessToken: fixtures.accessToken,
        projectId: fixtures.projectId,
        baseUrl: fixtures.endpoint,
      });
      const fixturesResolver = vi.fn().mockImplementation(async (tr) => {
        if (tr.id === fixtures.testResults[0].id) {
          return fixtures.fixtures;
        }

        return [];
      });

      await client.initialize(fixtures.launchName);
      await client.uploadTestResults({
        trs: fixtures.testResults,
        attachmentsResolver: () => Promise.resolve([]),
        fixturesResolver,
      });

      expect(fixturesResolver).toHaveBeenCalledTimes(fixtures.testResults.length);
      expect(fixturesResolver).toHaveBeenNthCalledWith(1, fixtures.testResults[0]);
      expect(fixturesResolver).toHaveBeenNthCalledWith(2, fixtures.testResults[1]);
      expect(fixturesResolver).toHaveBeenNthCalledWith(3, fixtures.testResults[2]);
      expect(AxiosMock.post).toHaveBeenCalledWith(
        `/api/upload/test-result/${fixtures.testOpsResults[0].id}/test-fixture-result`,
        { fixtures: fixtures.fixtures },
        expect.anything(),
      );
    });
  });
});
