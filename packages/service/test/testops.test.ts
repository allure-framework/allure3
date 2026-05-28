import { readFile } from "node:fs/promises";
import { join as joinPosix } from "node:path/posix";

import type { HistoryDataPoint } from "@allurereport/core-api";
import { type MockedFunction, beforeEach, describe, expect, it, vi } from "vitest";

import type { AllureTestOpsClient } from "../src/testops.js";
import { HttpClientMock, createHttpClientMock } from "./utils.js";

const testOpsAccessToken = "testops-access-token";
const testOpsUrl = "https://testops.example.com";
const createAccessToken = (payload: Record<string, unknown>) =>
  `ato1.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
const validAccessToken = createAccessToken({ accessToken: testOpsAccessToken, url: testOpsUrl, projectId: 123 });
const validAccessTokenWithStringProjectId = createAccessToken({
  accessToken: testOpsAccessToken,
  url: testOpsUrl,
  projectId: "123",
});
const uploadConfig = {
  uploadConcurrency: 100,
  uploadMaxAttempts: 5,
  uploadMaxSimultaneousFailures: 5,
};

const fixtures = {
  accessToken: validAccessToken,
  testOpsAccessToken,
  url: testOpsUrl,
  projectId: 123,
  report: "11111111-1111-1111-1111-111111111111",
  reportName: "Build #42",
  filename: "widgets/summary.json",
  pluginId: "awesome",
  history: {
    uuid: "1",
    knownTestCaseIds: [],
    testResults: {},
    metrics: {},
    url: "",
    timestamp: 1717622400000,
    status: "passed",
    stage: "test",
    name: "test",
  } as HistoryDataPoint,
};

const expectMultipartUpload = async (expected: {
  endpoint: string;
  filename: string;
  content: string;
  contentType: string;
  signal?: AbortSignal;
}) => {
  expect(HttpClientMock.prototype.post).toHaveBeenLastCalledWith(expected.endpoint, {
    body: expect.any(FormData),
    headers: {
      "Content-Type": "multipart/form-data",
    },
    ...(expected.signal ? { signal: expected.signal } : {}),
  });

  const [, payload] = HttpClientMock.prototype.post.mock.calls.at(-1) as [
    string,
    {
      body: FormData;
    },
  ];
  const uploadedFile = payload.body.get("file");

  expect(payload.body.get("filename")).toBe(expected.filename);
  expect(uploadedFile).toBeInstanceOf(Blob);
  expect(uploadedFile).toBeInstanceOf(File);
  expect(typeof uploadedFile).not.toBe("string");
  expect((uploadedFile as Blob).type).toBe(expected.contentType);
  expect((uploadedFile as File).name).toBe(expected.filename);
  expect(await (uploadedFile as Blob).text()).toBe(expected.content);
};

const { AllureTestOpsClient: AllureTestOpsClientClass } = await import("../src/testops.js");

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));
vi.mock("../src/utils/http.js", async (importOriginal) => ({
  ...(await importOriginal()),
  createServiceHttpClient: createHttpClientMock,
}));

describe("AllureTestOpsClient", () => {
  let testOpsClient: AllureTestOpsClient;
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);

    testOpsClient = new AllureTestOpsClientClass({
      ...uploadConfig,
      accessToken: fixtures.accessToken,
    });
  });

  describe("constructor", () => {
    it("should throw an error if access token is not provided", () => {
      expect(() =>
        new AllureTestOpsClientClass({ ...uploadConfig, accessToken: undefined as unknown as string }),
      ).toThrow(
        "Allure TestOps access token is required",
      );
    });

    it("should throw an error if access token is invalid", () => {
      expect(() => new AllureTestOpsClientClass({ ...uploadConfig, accessToken: "invalid-token" })).toThrow(
        "Allure service access token is invalid",
      );
    });

    it("should throw an error if token payload doesn't contain a project ID", () => {
      expect(
        () =>
          new AllureTestOpsClientClass({
            ...uploadConfig,
            accessToken: createAccessToken({ accessToken: fixtures.testOpsAccessToken, url: fixtures.url }),
          }),
      ).toThrow("Given access token doesn't contain project id");
    });

    it("should throw an error if token payload doesn't contain a URL", () => {
      expect(
        () =>
          new AllureTestOpsClientClass({
            ...uploadConfig,
            accessToken: createAccessToken({ accessToken: fixtures.testOpsAccessToken, projectId: fixtures.projectId }),
          }),
      ).toThrow("Allure service access token is invalid");
    });

    it("should create the HTTP client with API token from access token payload", async () => {
      const client = new AllureTestOpsClientClass({
        ...uploadConfig,
        accessToken: fixtures.accessToken,
      });

      HttpClientMock.prototype.post.mockResolvedValue({
        url: `${fixtures.url}/api/test-report/view/${fixtures.report}/index.html`,
      });

      await client.createReport({ reportName: fixtures.reportName, reportUuid: fixtures.report });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(createHttpClientMock).toHaveBeenCalledWith(fixtures.url, {
        apiToken: fixtures.testOpsAccessToken,
      });
    });
  });

  describe("downloadHistory", () => {
    it("should return an empty history because the TestOps upload API does not expose history", async () => {
      const res = await testOpsClient.downloadHistory({});

      expect(res).toEqual([]);
      expect(HttpClientMock.prototype.get).not.toHaveBeenCalled();
    });
  });

  describe("createReport", () => {
    it("should create a TestOps report", async () => {
      const reportUrl = `/api/test-report/view/${fixtures.report}/index.html`;

      HttpClientMock.prototype.post.mockResolvedValue({ url: reportUrl });

      const res = await testOpsClient.createReport({
        reportName: fixtures.reportName,
        reportUuid: fixtures.report,
      });

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith("/api/test-report", {
        body: {
          projectId: fixtures.projectId,
          reportName: fixtures.reportName,
          reportUuid: fixtures.report,
          isPublic: true,
        },
      });
      expect(res.href).toBe(`${fixtures.url}${reportUrl}`);
    });

    it("should send isPublic=false only when private mode is enabled", async () => {
      testOpsClient = new AllureTestOpsClientClass({
        ...uploadConfig,
        accessToken: fixtures.accessToken,
        private: true,
      });
      HttpClientMock.prototype.post.mockResolvedValue({
        url: `${fixtures.url}/api/test-report/view/${fixtures.report}/index.html`,
      });

      await testOpsClient.createReport({
        reportName: fixtures.reportName,
        reportUuid: fixtures.report,
      });

      expect(HttpClientMock.prototype.post).toHaveBeenLastCalledWith("/api/test-report", {
        body: {
          projectId: fixtures.projectId,
          reportName: fixtures.reportName,
          reportUuid: fixtures.report,
          isPublic: false,
        },
      });

      testOpsClient = new AllureTestOpsClientClass({
        ...uploadConfig,
        accessToken: fixtures.accessToken,
      });

      await testOpsClient.createReport({
        reportName: fixtures.reportName,
        reportUuid: fixtures.report,
      });

      expect(HttpClientMock.prototype.post).toHaveBeenLastCalledWith("/api/test-report", {
        body: {
          projectId: fixtures.projectId,
          reportName: fixtures.reportName,
          reportUuid: fixtures.report,
          isPublic: true,
        },
      });
    });

    it("should coerce project ID from access token payload to a number", async () => {
      testOpsClient = new AllureTestOpsClientClass({
        ...uploadConfig,
        accessToken: validAccessTokenWithStringProjectId,
      });
      HttpClientMock.prototype.post.mockResolvedValue({
        url: `${fixtures.url}/api/test-report/view/${fixtures.report}/index.html`,
      });

      await testOpsClient.createReport({
        reportName: fixtures.reportName,
        reportUuid: fixtures.report,
      });

      expect(HttpClientMock.prototype.post).toHaveBeenLastCalledWith("/api/test-report", {
        body: {
          projectId: fixtures.projectId,
          reportName: fixtures.reportName,
          reportUuid: fixtures.report,
          isPublic: true,
        },
      });
    });
  });

  describe("completeReport", () => {
    it("should complete a TestOps report without sending a history point", async () => {
      HttpClientMock.prototype.post.mockResolvedValue(undefined);

      const res = await testOpsClient.completeReport({
        reportUuid: fixtures.report,
        historyPoint: fixtures.history,
      });

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith(`/api/test-report/${fixtures.report}/complete`);
      expect(res).toBeUndefined();
    });
  });

  describe("deleteReport", () => {
    it("should delete a TestOps report", async () => {
      HttpClientMock.prototype.delete.mockResolvedValue(undefined);

      const res = await testOpsClient.deleteReport({
        reportUuid: fixtures.report,
        pluginId: fixtures.pluginId,
      });

      expect(HttpClientMock.prototype.delete).toHaveBeenCalledWith(`/api/test-report/${fixtures.report}`);
      expect(res).toBeUndefined();
    });
  });

  describe("addReportAsset", () => {
    it("should upload a shared asset to the TestOps asset endpoint", async () => {
      HttpClientMock.prototype.post.mockResolvedValue(undefined);

      const res = await testOpsClient.addReportAsset({
        filename: "app.js",
        file: Buffer.from("console.log('test');"),
      });

      await expectMultipartUpload({
        endpoint: "/api/test-report/upload",
        filename: "app.js",
        content: "console.log('test');",
        contentType: "application/javascript",
      });
      expect(res).toBeUndefined();
    });

    it("should upload a shared asset from a filepath with an abort signal", async () => {
      const signal = new AbortController().signal;

      (readFile as MockedFunction<typeof readFile>).mockResolvedValue(Buffer.from("body {}"));
      HttpClientMock.prototype.post.mockResolvedValue(undefined);

      await testOpsClient.addReportAsset({
        filename: "styles.css",
        filepath: "styles.css",
        signal,
      });

      expect(readFile).toHaveBeenCalledWith("styles.css", { signal });
      await expectMultipartUpload({
        endpoint: "/api/test-report/upload",
        filename: "styles.css",
        content: "body {}",
        contentType: "text/css",
        signal,
      });
    });
  });

  describe("addReportFile", () => {
    it("should upload a report-specific file to the TestOps report upload endpoint", async () => {
      HttpClientMock.prototype.post.mockResolvedValue(undefined);

      const res = await testOpsClient.addReportFile({
        reportUuid: fixtures.report,
        pluginId: fixtures.pluginId,
        filename: fixtures.filename,
        file: Buffer.from("{}"),
      });

      await expectMultipartUpload({
        endpoint: `/api/test-report/${fixtures.report}/upload`,
        filename: joinPosix(fixtures.pluginId, fixtures.filename),
        content: "{}",
        contentType: "application/json",
      });
      expect(res).toBe(
        `${fixtures.url}/api/test-report/view/${fixtures.report}/${fixtures.pluginId}/${fixtures.filename}`,
      );
    });

    it("should fall back to octet-stream for unknown file extensions", async () => {
      HttpClientMock.prototype.post.mockResolvedValue(undefined);

      await testOpsClient.addReportFile({
        reportUuid: fixtures.report,
        filename: "data/attachments/log",
        file: Buffer.from("log"),
      });

      await expectMultipartUpload({
        endpoint: `/api/test-report/${fixtures.report}/upload`,
        filename: "data/attachments/log",
        content: "log",
        contentType: "application/octet-stream",
      });
    });
  });

  describe("uploadReport", () => {
    it("uploads files through shared helper", async () => {
      (readFile as MockedFunction<typeof readFile>).mockResolvedValue(Buffer.from("<html></html>"));
      HttpClientMock.prototype.post.mockResolvedValue(undefined);

      const result = await testOpsClient.uploadReport({
        reportUuid: fixtures.report,
        pluginId: fixtures.pluginId,
        files: {
          "index.html": "index.html",
        },
      });

      expect(result.indexHref).toBe(`${fixtures.url}/api/test-report/view/${fixtures.report}/${fixtures.pluginId}/index.html`);
      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith(`/api/test-report/${fixtures.report}/upload`, expect.anything());
    });
  });
});
