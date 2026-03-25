import type {
  AttachmentLink,
  CiDescriptor,
  TestError,
  TestResult,
  TestStatus,
  TestStepResult,
} from "@allurereport/core-api";
import FormData from "form-data";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TestOpsClient } from "../src/client.js";
import type { TestOpsLaunch, TestOpsNamedEnv } from "../src/model.js";
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

    it("should throw an error when limit is greater than 5", () => {
      expect(
        () =>
          new TestOpsClient({
            accessToken: fixtures.accessToken,
            projectId: fixtures.projectId,
            baseUrl: fixtures.endpoint,
            limit: 6,
          }),
      ).toThrow("limit can't be greater than 5");
    });

    it("should not throw when limit is 5 or less", () => {
      expect(
        () =>
          new TestOpsClient({
            accessToken: fixtures.accessToken,
            projectId: fixtures.projectId,
            baseUrl: fixtures.endpoint,
            limit: 5,
          }),
      ).not.toThrow();
    });

    it("should not throw when limit is not provided", () => {
      expect(
        () =>
          new TestOpsClient({
            accessToken: fixtures.accessToken,
            projectId: fixtures.projectId,
            baseUrl: fixtures.endpoint,
          }),
      ).not.toThrow();
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

      expect(AxiosMock.post).toHaveBeenCalledWith("/api/upload/start", {
        projectId: fixtures.projectId,
        ci: { name: fixtures.ci.type },
        job: { name: fixtures.ci.jobUid, uid: fixtures.ci.jobUid },
        jobRun: { uid: fixtures.ci.jobRunUid },
        launch: { id: fixtures.launch.id },
      });
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

      expect(AxiosMock.post).toHaveBeenCalledWith("/api/upload/stop", {
        jobRunUid: fixtures.ci.jobRunUid,
        jobUid: fixtures.ci.jobUid,
        projectId: fixtures.projectId,
        status: fixtures.uploadStatus,
      });
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
      expect(AxiosMock.post).toHaveBeenNthCalledWith(2, "/api/launch", {
        name: fixtures.launchName,
        projectId: fixtures.projectId,
        autoclose: true,
        external: true,
        tags: fixtures.launchTags.map((tag) => ({ name: tag })),
      });
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
      expect(AxiosMock.post).toHaveBeenNthCalledWith(2, "/api/launch", expect.anything());
      expect(AxiosMock.post).toHaveBeenNthCalledWith(3, "/api/upload/session?manual=true", {
        launchId: fixtures.launch.id,
        environment: [],
      });
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

      expect(AxiosMock.post).toHaveBeenNthCalledWith(3, "/api/upload/session?manual=true", {
        launchId: fixtures.launch.id,
        environment: [
          { key: "NODE_ENV", value: "test" },
          { key: "CI", value: "true" },
          { key: "BUILD_NUMBER", value: "42" },
        ],
      });
    });
  });

  describe("createNamedEnvs", () => {
    it("should throw an error when session hasn't been created before", async () => {
      const client = new TestOpsClient({
        accessToken: fixtures.accessToken,
        projectId: fixtures.projectId,
        baseUrl: fixtures.endpoint,
      });

      await expect(async () => await client.createNamedEnvs([{ id: "chrome", name: "chrome" }])).rejects.toThrow(
        "Session isn't created! Call createSession first",
      );
    });

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

      await expect(async () => await client.createNamedEnvs([{ id: "chrome", name: "chrome" }])).rejects.toThrow();
    });

    it("should post environments to /api/launch/named-env/bulk", async () => {
      const namedEnvs: TestOpsNamedEnv[] = [
        { id: 10, name: "chrome", externalId: "chrome", jobRunId: 1, launchId: fixtures.launch.id },
        { id: 11, name: "firefox", externalId: "firefox", jobRunId: 1, launchId: fixtures.launch.id },
      ];

      AxiosMock.post.mockImplementation((url: string) => {
        if (url === "/api/uaa/oauth/token") {
          return Promise.resolve({ data: { access_token: fixtures.ouathToken } });
        }

        if (url === "/api/launch") {
          return Promise.resolve({ data: fixtures.launch });
        }

        if (url === "/api/upload/session?manual=true") {
          return Promise.resolve({ data: { id: 1 } });
        }

        if (url === "/api/launch/named-env/bulk") {
          return Promise.resolve({ data: namedEnvs });
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
      await client.createNamedEnvs([
        { id: "chrome", name: "Chrome" },
        { id: "firefox", name: "Firefox" },
      ]);

      expect(AxiosMock.post).toHaveBeenCalledWith(
        "/api/launch/named-env/bulk",
        {
          launchId: fixtures.launch.id,
          items: [
            { externalId: "chrome", name: "Chrome" },
            { externalId: "firefox", name: "Firefox" },
          ],
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    });
  });

  describe("uploadGlobalAttachments", () => {
    it("should throw an error when session hasn't been created before", async () => {
      const client = new TestOpsClient({
        accessToken: fixtures.accessToken,
        projectId: fixtures.projectId,
        baseUrl: fixtures.endpoint,
      });

      await expect(
        async () =>
          await client.uploadGlobalAttachments({
            attachments: [],
            attachmentsResolver: () => Promise.resolve(null),
          }),
      ).rejects.toThrow("Session isn't created! Call createSession first");
    });

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

      await expect(
        async () =>
          await client.uploadGlobalAttachments({
            attachments: [],
            attachmentsResolver: () => Promise.resolve(null),
          }),
      ).rejects.toThrow();
    });

    it("should upload attachments to /api/launch/attachment", async () => {
      AxiosMock.post.mockImplementation((url: string) => {
        if (url === "/api/uaa/oauth/token") {
          return Promise.resolve({ data: { access_token: fixtures.ouathToken } });
        }

        if (url === "/api/launch") {
          return Promise.resolve({ data: fixtures.launch });
        }

        if (url === "/api/upload/session?manual=true") {
          return Promise.resolve({ data: { id: 1 } });
        }

        return Promise.resolve({ data: {} });
      });

      const client = new TestOpsClient({
        accessToken: fixtures.accessToken,
        projectId: fixtures.projectId,
        baseUrl: fixtures.endpoint,
      });
      const attachments = [{ id: "att-1", name: "file.txt", contentType: "text/plain" } as AttachmentLink];
      const attachmentsResolver = vi.fn().mockImplementation(async (attachmentLink: AttachmentLink) => ({
        originalFileName: attachmentLink.name,
        contentType: attachmentLink.contentType,
        content: Buffer.from("test content"),
      }));

      await client.issueOauthToken();
      await client.createLaunch(fixtures.launchName, fixtures.launchTags);
      await client.createSession();
      await client.uploadGlobalAttachments({ attachments, attachmentsResolver });

      expect(attachmentsResolver).toHaveBeenCalledTimes(1);
      expect(attachmentsResolver).toHaveBeenCalledWith(attachments[0]);
      expect(AxiosMock.post).toHaveBeenCalledWith(
        `/api/launch/attachment?launchId=${fixtures.launch.id}`,
        expect.any(FormData),
      );
    });

    it("should skip attachments when resolver returns null", async () => {
      AxiosMock.post.mockImplementation((url: string) => {
        if (url === "/api/uaa/oauth/token") {
          return Promise.resolve({ data: { access_token: fixtures.ouathToken } });
        }

        if (url === "/api/launch") {
          return Promise.resolve({ data: fixtures.launch });
        }

        if (url === "/api/upload/session?manual=true") {
          return Promise.resolve({ data: { id: 1 } });
        }

        return Promise.resolve({ data: {} });
      });

      const client = new TestOpsClient({
        accessToken: fixtures.accessToken,
        projectId: fixtures.projectId,
        baseUrl: fixtures.endpoint,
      });
      const attachments = [{ id: "att-1", name: "file.txt", contentType: "text/plain" } as AttachmentLink];
      const attachmentsResolver = vi.fn().mockResolvedValue(null);

      await client.issueOauthToken();
      await client.createLaunch(fixtures.launchName, fixtures.launchTags);
      await client.createSession();
      await client.uploadGlobalAttachments({ attachments, attachmentsResolver });

      expect(attachmentsResolver).toHaveBeenCalledTimes(1);
      expect(AxiosMock.post).toHaveBeenCalledWith(
        `/api/launch/attachment?launchId=${fixtures.launch.id}`,
        expect.any(FormData),
      );
    });
  });

  describe("uploadGlobalErrors", () => {
    it("should throw an error when session hasn't been created before", async () => {
      const client = new TestOpsClient({
        accessToken: fixtures.accessToken,
        projectId: fixtures.projectId,
        baseUrl: fixtures.endpoint,
      });

      await expect(async () => await client.uploadGlobalErrors([])).rejects.toThrow(
        "Session isn't created! Call createSession first",
      );
    });

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

      await expect(async () => await client.uploadGlobalErrors([])).rejects.toThrow();
    });

    it("should post errors to /api/launch/error/bulk", async () => {
      AxiosMock.post.mockImplementation((url: string) => {
        if (url === "/api/uaa/oauth/token") {
          return Promise.resolve({ data: { access_token: fixtures.ouathToken } });
        }

        if (url === "/api/launch") {
          return Promise.resolve({ data: fixtures.launch });
        }

        if (url === "/api/upload/session?manual=true") {
          return Promise.resolve({ data: { id: 1 } });
        }

        return Promise.resolve({ data: {} });
      });

      const client = new TestOpsClient({
        accessToken: fixtures.accessToken,
        projectId: fixtures.projectId,
        baseUrl: fixtures.endpoint,
      });
      const errors = [{ message: "Something went wrong" } as TestError, { message: "Another error" } as TestError];

      await client.issueOauthToken();
      await client.createLaunch(fixtures.launchName, fixtures.launchTags);
      await client.createSession();
      await client.uploadGlobalErrors(errors);

      expect(AxiosMock.post).toHaveBeenCalledWith("/api/launch/error/bulk", {
        launchId: fixtures.launch.id,
        items: errors,
      });
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
            envNamesById: {},
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
        envNamesById: {},
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

    it("should limit concurrent per-TR uploads to the configured limit", async () => {
      let concurrentCount = 0;
      let maxConcurrentCount = 0;
      const limit = 2;

      AxiosMock.post.mockImplementation(async (url: string) => {
        if (url === "/api/uaa/oauth/token") {
          return { data: { access_token: fixtures.ouathToken } };
        }

        if (url === "/api/launch") {
          return { data: fixtures.launch };
        }

        if (url === "/api/upload/session?manual=true") {
          return { data: { id: 1 } };
        }

        if (url === "/api/upload/test-result") {
          return { data: { results: fixtures.testOpsResults } };
        }

        // simulate async work for attachment uploads to make per-TR concurrency observable
        concurrentCount++;
        maxConcurrentCount = Math.max(maxConcurrentCount, concurrentCount);
        await new Promise((resolve) => setTimeout(resolve, 10));
        concurrentCount--;

        return { data: {} };
      });

      const client = new TestOpsClient({
        accessToken: fixtures.accessToken,
        projectId: fixtures.projectId,
        baseUrl: fixtures.endpoint,
        limit,
      });

      await client.issueOauthToken();
      await client.createLaunch(fixtures.launchName, fixtures.launchTags);
      await client.createSession();
      await client.uploadTestResults({
        trs: fixtures.testResults,
        envNamesById: {},
        attachmentsResolver: () => Promise.resolve(fixtures.attachments),
        fixturesResolver: () => Promise.resolve([]),
      });

      expect(maxConcurrentCount).toBeLessThanOrEqual(limit);
    });

    it("should create named environments for test results with environment ids and display names", async () => {
      const namedEnvs: TestOpsNamedEnv[] = [
        { id: 10, name: "Chrome", externalId: "chrome", jobRunId: 1, launchId: fixtures.launch.id },
        { id: 11, name: "Firefox", externalId: "firefox", jobRunId: 1, launchId: fixtures.launch.id },
      ];

      AxiosMock.post.mockImplementation((url: string) => {
        if (url === "/api/uaa/oauth/token") {
          return Promise.resolve({ data: { access_token: fixtures.ouathToken } });
        }

        if (url === "/api/launch") {
          return Promise.resolve({ data: fixtures.launch });
        }

        if (url === "/api/upload/session?manual=true") {
          return Promise.resolve({ data: { id: 1 } });
        }

        if (url === "/api/launch/named-env/bulk") {
          return Promise.resolve({ data: namedEnvs });
        }

        if (url === "/api/upload/test-result") {
          return Promise.resolve({ data: { results: fixtures.testOpsResults.slice(0, 2) } });
        }

        return Promise.resolve({ data: {} });
      });

      const trsWithEnv: TestResult[] = [
        { ...fixtures.testResults[0], environment: "chrome" },
        { ...fixtures.testResults[1], environment: "firefox" },
      ];

      const client = new TestOpsClient({
        accessToken: fixtures.accessToken,
        projectId: fixtures.projectId,
        baseUrl: fixtures.endpoint,
      });

      await client.issueOauthToken();
      await client.createLaunch(fixtures.launchName, fixtures.launchTags);
      await client.createSession();
      await client.uploadTestResults({
        trs: trsWithEnv,
        envNamesById: {
          chrome: "Chrome",
          firefox: "Firefox",
        },
        attachmentsResolver: () => Promise.resolve([]),
        fixturesResolver: () => Promise.resolve([]),
      });

      expect(AxiosMock.post).toHaveBeenCalledWith(
        "/api/launch/named-env/bulk",
        {
          launchId: fixtures.launch.id,
          items: [
            { externalId: "chrome", name: "Chrome" },
            { externalId: "firefox", name: "Firefox" },
          ],
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      expect(AxiosMock.post).toHaveBeenCalledWith(
        "/api/upload/test-result",
        expect.objectContaining({
          results: expect.arrayContaining([
            expect.objectContaining({ uuid: "0-0-0-0", namedEnv: { id: 10 } }),
            expect.objectContaining({ uuid: "1-1-1-1", namedEnv: { id: 11 } }),
          ]),
        }),
        expect.anything(),
      );
    });

    it("should create distinct named environments for different env ids sharing one display name", async () => {
      const namedEnvs: TestOpsNamedEnv[] = [
        { id: 10, name: "QA", externalId: "qa_a", jobRunId: 1, launchId: fixtures.launch.id },
        { id: 11, name: "QA", externalId: "qa_b", jobRunId: 1, launchId: fixtures.launch.id },
      ];

      AxiosMock.post.mockImplementation((url: string) => {
        if (url === "/api/uaa/oauth/token") {
          return Promise.resolve({ data: { access_token: fixtures.ouathToken } });
        }

        if (url === "/api/launch") {
          return Promise.resolve({ data: fixtures.launch });
        }

        if (url === "/api/upload/session?manual=true") {
          return Promise.resolve({ data: { id: 1 } });
        }

        if (url === "/api/launch/named-env/bulk") {
          return Promise.resolve({ data: namedEnvs });
        }

        if (url === "/api/upload/test-result") {
          return Promise.resolve({ data: { results: fixtures.testOpsResults.slice(0, 2) } });
        }

        return Promise.resolve({ data: {} });
      });

      const trsWithSharedDisplayName: TestResult[] = [
        { ...fixtures.testResults[0], environment: "qa_a" },
        { ...fixtures.testResults[1], environment: "qa_b" },
      ];

      const client = new TestOpsClient({
        accessToken: fixtures.accessToken,
        projectId: fixtures.projectId,
        baseUrl: fixtures.endpoint,
      });

      await client.issueOauthToken();
      await client.createLaunch(fixtures.launchName, fixtures.launchTags);
      await client.createSession();
      await client.uploadTestResults({
        trs: trsWithSharedDisplayName,
        envNamesById: {
          qa_a: "QA",
          qa_b: "QA",
        },
        attachmentsResolver: () => Promise.resolve([]),
        fixturesResolver: () => Promise.resolve([]),
      });

      expect(AxiosMock.post).toHaveBeenCalledWith(
        "/api/launch/named-env/bulk",
        {
          launchId: fixtures.launch.id,
          items: [
            { externalId: "qa_a", name: "QA" },
            { externalId: "qa_b", name: "QA" },
          ],
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      expect(AxiosMock.post).toHaveBeenCalledWith(
        "/api/upload/test-result",
        expect.objectContaining({
          results: expect.arrayContaining([
            expect.objectContaining({ uuid: "0-0-0-0", namedEnv: { id: 10 } }),
            expect.objectContaining({ uuid: "1-1-1-1", namedEnv: { id: 11 } }),
          ]),
        }),
        expect.anything(),
      );
    });

    it("should not create named environments when test results have no environment", async () => {
      AxiosMock.post.mockImplementation((url: string) => {
        if (url === "/api/uaa/oauth/token") {
          return Promise.resolve({ data: { access_token: fixtures.ouathToken } });
        }

        if (url === "/api/launch") {
          return Promise.resolve({ data: fixtures.launch });
        }

        if (url === "/api/upload/session?manual=true") {
          return Promise.resolve({ data: { id: 1 } });
        }

        if (url === "/api/upload/test-result") {
          return Promise.resolve({ data: { results: fixtures.testOpsResults } });
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
      await client.uploadTestResults({
        trs: fixtures.testResults,
        envNamesById: {},
        attachmentsResolver: () => Promise.resolve([]),
        fixturesResolver: () => Promise.resolve([]),
      });

      const namedEnvCalls = AxiosMock.post.mock.calls.filter((call: any[]) => call[0] === "/api/launch/named-env/bulk");

      expect(namedEnvCalls).toHaveLength(0);
    });

    it("should not re-create named environments that were already created", async () => {
      const namedEnvs: TestOpsNamedEnv[] = [
        { id: 10, name: "chrome", externalId: "chrome", jobRunId: 1, launchId: fixtures.launch.id },
      ];

      AxiosMock.post.mockImplementation((url: string) => {
        if (url === "/api/uaa/oauth/token") {
          return Promise.resolve({ data: { access_token: fixtures.ouathToken } });
        }

        if (url === "/api/launch") {
          return Promise.resolve({ data: fixtures.launch });
        }

        if (url === "/api/upload/session?manual=true") {
          return Promise.resolve({ data: { id: 1 } });
        }

        if (url === "/api/launch/named-env/bulk") {
          return Promise.resolve({ data: namedEnvs });
        }

        if (url === "/api/upload/test-result") {
          return Promise.resolve({ data: { results: [fixtures.testOpsResults[0]] } });
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
      await client.uploadTestResults({
        trs: [{ ...fixtures.testResults[0], environment: "chrome" }],
        envNamesById: {
          chrome: "Chrome",
        },
        attachmentsResolver: () => Promise.resolve([]),
        fixturesResolver: () => Promise.resolve([]),
      });

      vi.clearAllMocks();

      AxiosMock.post.mockImplementation((url: string) => {
        if (url === "/api/upload/test-result") {
          return Promise.resolve({ data: { results: [fixtures.testOpsResults[1]] } });
        }

        return Promise.resolve({ data: {} });
      });

      await client.uploadTestResults({
        trs: [{ ...fixtures.testResults[1], environment: "chrome" }],
        envNamesById: {
          chrome: "Chrome",
        },
        attachmentsResolver: () => Promise.resolve([]),
        fixturesResolver: () => Promise.resolve([]),
      });

      const namedEnvCalls = AxiosMock.post.mock.calls.filter((call: any[]) => call[0] === "/api/launch/named-env/bulk");

      expect(namedEnvCalls).toHaveLength(0);
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
        envNamesById: {},
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
      );
    });
  });
});
