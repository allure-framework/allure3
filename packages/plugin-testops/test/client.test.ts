import type { AttachmentLink, CiDescriptor, TestResult, TestStatus, TestStepResult } from "@allurereport/core-api";
import FormData from "form-data";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TestOpsClient } from "../src/client.js";
import type { TestOpsLaunch } from "../src/model.js";
import { AxiosMock, BASE_URL } from "./utils.js";

const fixtures = {
  accessToken: "test",
  ouathToken: "tset",
  endpoint: "http://example.com",
  projectId: "12345",
  launch: {
    id: 123,
  } as TestOpsLaunch,
  launchName: "Test Launch",
  launchTags: [] as string[],
  ci: {
    type: "github",
    jobName: "job",
    jobRunName: "run",
    jobUid: "job-uid",
    jobRunUid: "job-run-uid",
  } as unknown as CiDescriptor,
  uploadStatus: "passed" as TestStatus,
  testResults: [{ id: "0-0-0-0" } as TestResult, { id: "1-1-1-1" } as TestResult, { id: "2-2-2-2" } as TestResult],
  testOpsResults: [
    { id: 1, uuid: "0-0-0-0" },
    { id: 2, uuid: "1-1-1-1" },
    { id: 3, uuid: "2-2-2-2" },
  ],
  attachments: [
    {
      originalFileName: "test.txt",
      contentType: "text/plain",
    } as AttachmentLink,
  ],
  fixtures: [{ name: "before hook" } as TestStepResult, { name: "after hook" } as TestStepResult],
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
      await client.createLaunch(fixtures.launchName, fixtures.launchTags);

      expect(client.launchUrl).toBe(`${BASE_URL}/launch/${fixtures.launch.id}`);
    });
  });

  describe("startUpload", () => {
    it("should throw an error when launch hasn't been created before", async () => {
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

      await expect(async () => await client.startUpload(fixtures.ci)).rejects.toThrow();
      expect(AxiosMock.post).toHaveBeenCalledTimes(1);
      expect(AxiosMock.post).toHaveBeenLastCalledWith("/api/uaa/oauth/token", expect.anything());
    });

    it("should call /api/upload/start with ci metadata", async () => {
      AxiosMock.post.mockImplementation((url: string) => {
        if (url === "/api/uaa/oauth/token") {
          return Promise.resolve({ data: { access_token: fixtures.ouathToken } });
        }

        if (url === "/api/launch") {
          return Promise.resolve({ data: fixtures.launch });
        }

        if (url === "/api/upload/start") {
          return Promise.resolve({ data: {} });
        }

        return Promise.resolve({ data: {} });
      });

      const client = new TestOpsClient({
        accessToken: fixtures.accessToken,
        projectId: fixtures.projectId,
        baseUrl: fixtures.endpoint,
      });

      await client.issueOauthToken();
      await client.createLaunch(fixtures.launchName, fixtures.launchTags);
      await client.startUpload(fixtures.ci);

      expect(AxiosMock.post).toHaveBeenCalledWith(
        "/api/upload/start",
        {
          projectId: fixtures.projectId,
          ci: { name: fixtures.ci.type },
          job: { name: fixtures.ci.jobUid, uid: fixtures.ci.jobUid },
          jobRun: { uid: fixtures.ci.jobRunUid },
          launch: { id: fixtures.launch.id },
        },
        {
          headers: {
            Authorization: `Bearer ${fixtures.ouathToken}`,
          },
        },
      );
    });
  });

  describe("stopUpload", () => {
    it("should throw an error when upload hasn't been started before", async () => {
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

      await expect(async () => await client.stopUpload(fixtures.ci, fixtures.uploadStatus)).rejects.toThrow();
    });

    it("should call /api/upload/stop after startUpload", async () => {
      AxiosMock.post.mockImplementation((url: string) => {
        if (url === "/api/uaa/oauth/token") {
          return Promise.resolve({ data: { access_token: fixtures.ouathToken } });
        }

        if (url === "/api/launch") {
          return Promise.resolve({ data: fixtures.launch });
        }

        if (url === "/api/upload/start") {
          return Promise.resolve({ data: {} });
        }

        if (url === "/api/upload/stop") {
          return Promise.resolve({ data: {} });
        }

        return Promise.resolve({ data: {} });
      });

      const client = new TestOpsClient({
        accessToken: fixtures.accessToken,
        projectId: fixtures.projectId,
        baseUrl: fixtures.endpoint,
      });

      await client.issueOauthToken();
      await client.createLaunch(fixtures.launchName, fixtures.launchTags);
      await client.startUpload(fixtures.ci);
      await client.stopUpload(fixtures.ci, fixtures.uploadStatus);

      expect(AxiosMock.post).toHaveBeenCalledWith(
        "/api/upload/stop",
        {
          jobRunUid: fixtures.ci.jobRunUid,
          jobUid: fixtures.ci.jobUid,
          projectId: fixtures.projectId,
          status: fixtures.uploadStatus,
        },
        {
          headers: {
            Authorization: `Bearer ${fixtures.ouathToken}`,
          },
        },
      );
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
      await client.createLaunch(fixtures.launchName, fixtures.launchTags);

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
          tags: fixtures.launchTags.map((tag) => ({ name: tag })),
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

      await expect(async () => await client.createSession()).rejects.toThrow();
      expect(AxiosMock.post).toHaveBeenCalledTimes(0);
    });

    it("should create a session for a current launch with empty environment by default", async () => {
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
      await client.createLaunch(fixtures.launchName, fixtures.launchTags);
      await client.createSession();

      expect(AxiosMock.post).toHaveBeenCalledTimes(3);
      expect(AxiosMock.post).toHaveBeenNthCalledWith(1, "/api/uaa/oauth/token", expect.anything());
      expect(AxiosMock.post).toHaveBeenNthCalledWith(2, "/api/launch", expect.anything(), expect.anything());
      expect(AxiosMock.post).toHaveBeenNthCalledWith(
        3,
        "/api/upload/session?manual=true",
        {
          launchId: fixtures.launch.id,
          environment: [],
        },
        {
          headers: {
            Authorization: `Bearer ${fixtures.ouathToken}`,
          },
        },
      );
    });

    it("should pass environment variables as key-value pairs to the session", async () => {
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
      const environment = { NODE_ENV: "test", CI: "true", BUILD_NUMBER: 42 };

      await client.issueOauthToken();
      await client.createLaunch(fixtures.launchName, fixtures.launchTags);
      await client.createSession(environment);

      expect(AxiosMock.post).toHaveBeenNthCalledWith(
        3,
        "/api/upload/session?manual=true",
        {
          launchId: fixtures.launch.id,
          environment: [
            { key: "NODE_ENV", value: "test" },
            { key: "CI", value: "true" },
            { key: "BUILD_NUMBER", value: "42" },
          ],
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

      await expect(
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

      await client.issueOauthToken();
      await client.createLaunch(fixtures.launchName, fixtures.launchTags);
      await client.createSession();
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

      await client.issueOauthToken();
      await client.createLaunch(fixtures.launchName, fixtures.launchTags);
      await client.createSession();
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
