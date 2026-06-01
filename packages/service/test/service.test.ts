import { readFile } from "node:fs/promises";
import { join as joinPosix } from "node:path/posix";

import type { HistoryDataPoint } from "@allurereport/core-api";
import { epic, feature, label, story } from "allure-js-commons";
import { type MockedFunction, beforeEach, describe, expect, it, vi } from "vitest";

import type { AllureServiceClient } from "../src/service.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("service");
  await story("service");
  await label("coverage", "service");
});
import { HttpClientMock, createHttpClientMock } from "./utils.js";

const serviceAccessToken = "service-access-token";
const serviceUrl = "https://service.allurereport.org";
const createAccessToken = (payload: Record<string, string>) =>
  `ars1.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
const validAccessToken = createAccessToken({ accessToken: serviceAccessToken, url: serviceUrl });
const uploadConfig = {
  uploadConcurrency: 100,
  uploadMaxAttempts: 5,
  uploadMaxSimultaneousFailures: 5,
};

const fixtures = {
  accessToken: validAccessToken,
  serviceAccessToken,
  newAccessToken: "new-access-token",
  project: "test-project-id",
  url: serviceUrl,
  email: "test@test.com",
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
  report: "report-uuid",
  reportName: "Test Report",
  filename: "data.json",
  pluginId: "sample",
  repo: "allure3",
  branch: "main",
};

const expectMultipartUpload = async (expected: {
  endpoint: string;
  filename: string;
  content: string;
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
  expect((uploadedFile as Blob).type).toBe("application/octet-stream");
  expect((uploadedFile as File).name).toBe(expected.filename);
  expect(await (uploadedFile as Blob).text()).toBe(expected.content);
};

const { AllureServiceClient: AllureServiceClientClass } = await import("../src/service.js");

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));
vi.mock("../src/utils/http.js", async (importOriginal) => ({
  ...(await importOriginal()),
  createServiceHttpClient: createHttpClientMock,
}));

describe("AllureServiceClient", () => {
  let serviceClient: AllureServiceClient;

  beforeEach(() => {
    vi.clearAllMocks();

    serviceClient = new AllureServiceClientClass({
      ...uploadConfig,
      accessToken: fixtures.accessToken,
    });
  });

  describe("constructor", () => {
    it("should throw an error if access token is not provided", () => {
      expect(
        () => new AllureServiceClientClass({ ...uploadConfig, accessToken: undefined as unknown as string }),
      ).toThrow("Allure service access token is required");
    });

    it("should throw an error if access token is invalid", () => {
      expect(() => new AllureServiceClientClass({ ...uploadConfig, accessToken: "invalid-token" })).toThrow(
        "Allure service access token is invalid",
      );
    });

    it("should throw an error if token payload doesn't contain a URL", () => {
      expect(
        () =>
          new AllureServiceClientClass({
            ...uploadConfig,
            accessToken: createAccessToken({ accessToken: serviceAccessToken }),
          }),
      ).toThrow("Allure service access token is invalid");
    });

    it("should successfully create client with valid config", () => {
      vi.clearAllMocks();

      expect(() => new AllureServiceClientClass({ ...uploadConfig, accessToken: validAccessToken })).not.toThrow();
      expect(createHttpClientMock).toHaveBeenCalledWith(fixtures.url, {
        accessToken: fixtures.accessToken,
      });
    });
  });

  describe("downloadHistory", () => {
    it("should download history for a repository branch", async () => {
      HttpClientMock.prototype.get.mockResolvedValue({ history: [fixtures.history] });

      const res = await serviceClient.downloadHistory({
        repo: fixtures.repo,
        branch: fixtures.branch,
      });

      expect(HttpClientMock.prototype.get).toHaveBeenCalledWith("/api/history", {
        params: {
          limit: undefined,
          repo: encodeURIComponent(fixtures.repo),
          branch: encodeURIComponent(fixtures.branch),
        },
      });
      expect(res).toEqual([fixtures.history]);
    });

    it("should download history with a provided limit", async () => {
      HttpClientMock.prototype.get.mockResolvedValue({ history: [fixtures.history] });

      const res = await serviceClient.downloadHistory({
        repo: fixtures.repo,
        branch: fixtures.branch,
        limit: 10,
      });

      expect(HttpClientMock.prototype.get).toHaveBeenCalledWith("/api/history", {
        params: {
          limit: "10",
          repo: encodeURIComponent(fixtures.repo),
          branch: encodeURIComponent(fixtures.branch),
        },
      });
      expect(res).toEqual([fixtures.history]);
    });

    it("should encode branch name in URL", async () => {
      HttpClientMock.prototype.get.mockResolvedValue({ history: [] });

      await serviceClient.downloadHistory({
        repo: fixtures.repo,
        branch: "feature/test-branch",
      });

      expect(HttpClientMock.prototype.get).toHaveBeenCalledWith("/api/history", {
        params: {
          limit: undefined,
          repo: encodeURIComponent(fixtures.repo),
          branch: encodeURIComponent("feature/test-branch"),
        },
      });
    });
  });

  describe("createReport", () => {
    it("should create a new report", async () => {
      const reportUrl = { url: `${fixtures.url}/${fixtures.report}` };

      HttpClientMock.prototype.post.mockResolvedValue(reportUrl);

      const res = await serviceClient.createReport({
        reportName: fixtures.reportName,
        reportUuid: fixtures.report,
        repo: fixtures.repo,
        branch: fixtures.branch,
      });

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith("/api/reports", {
        body: {
          reportName: fixtures.reportName,
          reportUuid: fixtures.report,
          repo: fixtures.repo,
          branch: fixtures.branch,
        },
      });
      expect(res.href).toBe(reportUrl.url);
    });

    it("should create a report without branch", async () => {
      const reportUrl = { url: `${fixtures.url}/${fixtures.report}` };

      HttpClientMock.prototype.post.mockResolvedValue(reportUrl);

      const res = await serviceClient.createReport({
        reportName: fixtures.reportName,
      });

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith("/api/reports", {
        body: {
          reportName: fixtures.reportName,
          reportUuid: undefined,
          repo: undefined,
          branch: undefined,
        },
      });
      expect(res.href).toBe(reportUrl.url);
    });
  });

  describe("completeReport", () => {
    it("should mark report as completed with a full history point URL", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({});

      const historyPoint = {
        ...fixtures.history,
        url: `/${fixtures.report}`,
      };
      const res = await serviceClient.completeReport({
        reportUuid: fixtures.report,
        historyPoint,
      });

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith(`/api/reports/${fixtures.report}/complete`, {
        body: {
          historyPoint: {
            ...historyPoint,
            url: `${fixtures.url}/${fixtures.report}`,
          },
        },
      });
      expect(historyPoint.url).toBe(`/${fixtures.report}`);
      expect(res).toEqual({});
    });
  });

  describe("deleteReport", () => {
    it("should delete a report", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({});

      const res = await serviceClient.deleteReport({
        reportUuid: fixtures.report,
      });

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith(`/api/report/${fixtures.report}/delete`, {
        body: {
          pluginId: "",
        },
      });
      expect(res).toEqual({});
    });

    it("should delete a report for a specific plugin", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({});

      const res = await serviceClient.deleteReport({
        reportUuid: fixtures.report,
        pluginId: fixtures.pluginId,
      });

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith(`/api/report/${fixtures.report}/delete`, {
        body: {
          pluginId: fixtures.pluginId,
        },
      });
      expect(res).toEqual({});
    });
  });

  describe("addReportAsset", () => {
    it("should throw an error unless a file or filepath is provided", async () => {
      await expect(serviceClient.addReportAsset({ filename: fixtures.filename })).rejects.toThrow(
        "File or filepath is required",
      );
    });

    it("should upload a given file", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({});

      const fileBuffer = Buffer.from("test-content");
      const res = await serviceClient.addReportAsset({
        filename: fixtures.filename,
        file: fileBuffer,
      });

      await expectMultipartUpload({
        endpoint: "/api/assets/upload",
        filename: fixtures.filename,
        content: "test-content",
      });
      expect(res).toEqual({});
    });

    it("should upload a file from a filepath", async () => {
      const fileBuffer = Buffer.from("test-content");
      (readFile as MockedFunction<typeof readFile>).mockResolvedValue(fileBuffer);
      HttpClientMock.prototype.post.mockResolvedValue({});

      const res = await serviceClient.addReportAsset({
        filename: fixtures.filename,
        filepath: "test.txt",
      });

      expect(readFile).toHaveBeenCalledWith("test.txt");
      await expectMultipartUpload({
        endpoint: "/api/assets/upload",
        filename: fixtures.filename,
        content: "test-content",
      });
      expect(res).toEqual({});
    });
  });

  describe("addReportFile", () => {
    it("should throw an error unless a file or filepath is provided", async () => {
      await expect(
        serviceClient.addReportFile({
          reportUuid: fixtures.report,
          pluginId: fixtures.pluginId,
          filename: fixtures.filename,
        }),
      ).rejects.toThrow("File or filepath is required");
    });

    it("should upload a given file", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({});

      const fileBuffer = Buffer.from("test-content");
      const res = await serviceClient.addReportFile({
        reportUuid: fixtures.report,
        pluginId: fixtures.pluginId,
        filename: fixtures.filename,
        file: fileBuffer,
      });

      await expectMultipartUpload({
        endpoint: `/api/reports/${fixtures.report}/upload`,
        filename: joinPosix(fixtures.pluginId, fixtures.filename),
        content: "test-content",
      });
      expect(res).toEqual(`${fixtures.url}/${fixtures.report}/${fixtures.pluginId}/${fixtures.filename}`);
    });

    it("should upload a file from a filepath", async () => {
      const fileBuffer = Buffer.from("test-content");
      (readFile as MockedFunction<typeof readFile>).mockResolvedValue(fileBuffer);
      HttpClientMock.prototype.post.mockResolvedValue({});

      const res = await serviceClient.addReportFile({
        reportUuid: fixtures.report,
        pluginId: fixtures.pluginId,
        filename: fixtures.filename,
        filepath: "test.txt",
      });

      expect(readFile).toHaveBeenCalledWith("test.txt");
      await expectMultipartUpload({
        endpoint: `/api/reports/${fixtures.report}/upload`,
        filename: joinPosix(fixtures.pluginId, fixtures.filename),
        content: "test-content",
      });
      expect(res).toEqual(`${fixtures.url}/${fixtures.report}/${fixtures.pluginId}/${fixtures.filename}`);
    });

    it("should upload a file without plugin ID", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({});

      const fileBuffer = Buffer.from("test-content");
      const res = await serviceClient.addReportFile({
        reportUuid: fixtures.report,
        filename: fixtures.filename,
        file: fileBuffer,
      });

      await expectMultipartUpload({
        endpoint: `/api/reports/${fixtures.report}/upload`,
        filename: fixtures.filename,
        content: "test-content",
      });
      expect(res).toEqual(`${fixtures.url}/${fixtures.report}/${fixtures.filename}`);
    });

    it("should preserve the URL protocol slashes in uploaded file hrefs", async () => {
      serviceClient = new AllureServiceClientClass({
        ...uploadConfig,
        accessToken: createAccessToken({ accessToken: fixtures.serviceAccessToken, url: "http://localhost:3000/" }),
      });
      HttpClientMock.prototype.post.mockResolvedValue({});

      const res = await serviceClient.addReportFile({
        reportUuid: fixtures.report,
        pluginId: "awesome",
        filename: "index.html",
        file: Buffer.from("test-content"),
      });

      await expectMultipartUpload({
        endpoint: `/api/reports/${fixtures.report}/upload`,
        filename: "awesome/index.html",
        content: "test-content",
      });
      expect(res).toEqual(`http://localhost:3000/${fixtures.report}/awesome/index.html`);
    });
  });

  describe("uploadReport", () => {
    it("uploads files through shared helper", async () => {
      (readFile as MockedFunction<typeof readFile>).mockResolvedValue(Buffer.from("<html></html>"));
      HttpClientMock.prototype.post.mockResolvedValue(undefined);

      const result = await serviceClient.uploadReport({
        reportUuid: fixtures.report,
        pluginId: fixtures.pluginId,
        files: {
          "index.html": "index.html",
        },
      });

      expect(result.indexHref).toBe(`${fixtures.url}/${fixtures.report}/${fixtures.pluginId}/index.html`);
      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith(
        `/api/reports/${fixtures.report}/upload`,
        expect.anything(),
      );
    });
  });
});
