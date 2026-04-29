import { readFile } from "node:fs/promises";
import { join as joinPosix } from "node:path/posix";

import type { HistoryDataPoint } from "@allurereport/core-api";
import { type MockedFunction, beforeEach, describe, expect, it, vi } from "vitest";

import type { AllureServiceClient } from "../src/service.js";
import { HttpClientMock, createHttpClientMock } from "./utils.js";

// JWT payload: { "iss": "allure-service", "url": "https://service.allurereport.org", "projectId": "test-project-id" }
const validAccessToken =
  "header.eyJpc3MiOiJhbGx1cmUtc2VydmljZSIsInVybCI6Imh0dHBzOi8vc2VydmljZS5hbGx1cmVyZXBvcnQub3JnIiwicHJvamVjdElkIjoidGVzdC1wcm9qZWN0LWlkIn0.signature";

// JWT payload: { "iss": "wrong-issuer", "url": "https://service.allurereport.org", "projectId": "test-project-id" }
const invalidIssuerToken =
  "header.eyJpc3MiOiJ3cm9uZy1pc3N1ZXIiLCJ1cmwiOiJodHRwczovL3NlcnZpY2UuYWxsdXJlcmVwb3J0Lm9yZyIsInByb2plY3RJZCI6InRlc3QtcHJvamVjdC1pZCJ9.signature";

const fixtures = {
  accessToken: validAccessToken,
  newAccessToken: "new-access-token",
  project: "test-project-id",
  url: "https://service.allurereport.org",
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
      url: fixtures.url,
      accessToken: fixtures.accessToken,
    });
  });

  describe("constructor", () => {
    it("should throw an error if access token is not provided", () => {
      expect(() => new AllureServiceClientClass({})).toThrow("Allure service URL is required");
    });

    it("should throw an error if access token is invalid", () => {
      expect(() => new AllureServiceClientClass({ url: fixtures.url, accessToken: invalidIssuerToken })).not.toThrow();
    });

    it("should throw an error if URL is not provided", () => {
      expect(() => new AllureServiceClientClass({ accessToken: "invalid-token" })).toThrow(
        "Allure service URL is required",
      );
    });

    it("should successfully create client with valid config", () => {
      expect(() => new AllureServiceClientClass({ url: fixtures.url, accessToken: validAccessToken })).not.toThrow();
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

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith(`/api/reports/${fixtures.report}/delete`, {
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

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith(`/api/reports/${fixtures.report}/delete`, {
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

    it("should throw an error if file size exceeds maximum", async () => {
      const largeBuffer = Buffer.alloc(201 * 1024 * 1024); // 201MB

      await expect(
        serviceClient.addReportAsset({
          filename: fixtures.filename,
          file: largeBuffer,
        }),
      ).rejects.toThrow("Asset size exceeds the maximum allowed size of 200MB");
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
        url: "http://localhost:3000/",
        accessToken: fixtures.accessToken,
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

    it("should throw an error if file size exceeds maximum", async () => {
      const largeBuffer = Buffer.alloc(201 * 1024 * 1024); // 201MB

      await expect(
        serviceClient.addReportFile({
          reportUuid: fixtures.report,
          filename: fixtures.filename,
          file: largeBuffer,
        }),
      ).rejects.toThrow("Report file size exceeds the maximum allowed size of 200MB");
    });
  });
});
