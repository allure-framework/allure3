import { readFile } from "node:fs/promises";
import { join as joinPosix } from "node:path/posix";

import type { HistoryDataPoint } from "@allurereport/core-api";
import { type MockedFunction, beforeEach, describe, expect, it, vi } from "vitest";

import type { AllureLegacyServiceClient } from "../src/legacyService.js";
import { HttpClientMock, createHttpClientMock } from "./utils.js";

// JWT payload: { "iss": "allure-service", "url": "https://service.allurereport.org", "projectId": "test-project-id" }
const validAccessToken =
  "header.eyJpc3MiOiJhbGx1cmUtc2VydmljZSIsInVybCI6Imh0dHBzOi8vc2VydmljZS5hbGx1cmVyZXBvcnQub3JnIiwicHJvamVjdElkIjoidGVzdC1wcm9qZWN0LWlkIn0.signature";

const fixtures = {
  accessToken: validAccessToken,
  url: "https://service.allurereport.org",
  reportUrl: "https://service.allurereport.org/reports/report-uuid/",
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
  branch: "feature/test-branch",
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

const { AllureLegacyServiceClient: AllureLegacyServiceClientClass } = await import("../src/legacyService.js");

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));
vi.mock("../src/utils/http.js", async (importOriginal) => ({
  ...(await importOriginal()),
  createServiceHttpClient: createHttpClientMock,
}));

describe("AllureLegacyServiceClient", () => {
  let serviceClient: AllureLegacyServiceClient;

  beforeEach(() => {
    vi.clearAllMocks();

    serviceClient = new AllureLegacyServiceClientClass({
      accessToken: fixtures.accessToken,
    });
  });

  describe("constructor", () => {
    it("should throw an error if access token is not provided", () => {
      expect(() => new AllureLegacyServiceClientClass({})).toThrow("Allure service access token is required");
    });

    it("should create the HTTP client from the service URL in the access token", () => {
      expect(createHttpClientMock).toHaveBeenCalledWith(fixtures.url, fixtures.accessToken);
    });
  });

  describe("downloadHistory", () => {
    it("should download history for a branch from the legacy endpoint", async () => {
      HttpClientMock.prototype.get.mockResolvedValue({ history: [fixtures.history] });

      const res = await serviceClient.downloadHistory({
        repo: fixtures.repo,
        branch: fixtures.branch,
        limit: 10,
      });

      expect(HttpClientMock.prototype.get).toHaveBeenCalledWith("/projects/history", {
        params: {
          limit: "10",
          branch: encodeURIComponent(fixtures.branch),
        },
      });
      expect(res).toEqual([fixtures.history]);
    });
  });

  describe("createReport", () => {
    it("should create a legacy report and remember the returned report URL", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({ url: fixtures.reportUrl });

      const res = await serviceClient.createReport({
        reportName: fixtures.reportName,
        reportUuid: fixtures.report,
        repo: fixtures.repo,
        branch: fixtures.branch,
      });

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith("/reports", {
        body: {
          reportName: fixtures.reportName,
          reportUuid: fixtures.report,
          branch: fixtures.branch,
        },
      });
      expect(res.href).toBe(fixtures.reportUrl);
    });
  });

  describe("completeReport", () => {
    it("should complete the report without rewriting the history point URL", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({});

      const historyPoint = {
        ...fixtures.history,
        url: `/${fixtures.report}`,
      };
      const res = await serviceClient.completeReport({
        reportUuid: fixtures.report,
        historyPoint,
      });

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith(`/reports/${fixtures.report}/complete`, {
        body: {
          historyPoint,
        },
      });
      expect(historyPoint.url).toBe(`/${fixtures.report}`);
      expect(res).toEqual({});
    });
  });

  describe("deleteReport", () => {
    it("should delete a report for a specific plugin", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({});

      const res = await serviceClient.deleteReport({
        reportUuid: fixtures.report,
        pluginId: fixtures.pluginId,
      });

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith(`/reports/${fixtures.report}/delete`, {
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

    it("should upload a given file to the legacy asset endpoint", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({});

      const res = await serviceClient.addReportAsset({
        filename: fixtures.filename,
        file: Buffer.from("test-content"),
      });

      await expectMultipartUpload({
        endpoint: "/assets/upload",
        filename: fixtures.filename,
        content: "test-content",
      });
      expect(res).toEqual({});
    });

    it("should upload a file from a filepath with an abort signal", async () => {
      const signal = new AbortController().signal;
      const fileBuffer = Buffer.from("test-content");

      (readFile as MockedFunction<typeof readFile>).mockResolvedValue(fileBuffer);
      HttpClientMock.prototype.post.mockResolvedValue({});

      const res = await serviceClient.addReportAsset({
        filename: fixtures.filename,
        filepath: "test.txt",
        signal,
      });

      expect(readFile).toHaveBeenCalledWith("test.txt", { signal });
      await expectMultipartUpload({
        endpoint: "/assets/upload",
        filename: fixtures.filename,
        content: "test-content",
        signal,
      });
      expect(res).toEqual({});
    });

    it("should throw an error if file size exceeds maximum", async () => {
      await expect(
        serviceClient.addReportAsset({
          filename: fixtures.filename,
          file: Buffer.alloc(201 * 1024 * 1024),
        }),
      ).rejects.toThrow("Asset size exceeds the maximum allowed size of 200MB");
    });
  });

  describe("addReportFile", () => {
    beforeEach(async () => {
      HttpClientMock.prototype.post.mockResolvedValue({ url: fixtures.reportUrl });

      await serviceClient.createReport({
        reportName: fixtures.reportName,
        reportUuid: fixtures.report,
      });

      HttpClientMock.prototype.post.mockClear();
    });

    it("should throw an error unless a file or filepath is provided", async () => {
      await expect(
        serviceClient.addReportFile({
          reportUuid: fixtures.report,
          pluginId: fixtures.pluginId,
          filename: fixtures.filename,
        }),
      ).rejects.toThrow("File or filepath is required");
    });

    it("should upload a report file and return a href under the created report URL", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({});

      const res = await serviceClient.addReportFile({
        reportUuid: fixtures.report,
        pluginId: fixtures.pluginId,
        filename: fixtures.filename,
        file: Buffer.from("test-content"),
      });

      await expectMultipartUpload({
        endpoint: `/reports/${fixtures.report}/upload`,
        filename: joinPosix(fixtures.pluginId, fixtures.filename),
        content: "test-content",
      });
      expect(res).toBe(`${fixtures.reportUrl}${fixtures.pluginId}/${fixtures.filename}`);
    });

    it("should upload a report file without a plugin ID", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({});

      const res = await serviceClient.addReportFile({
        reportUuid: fixtures.report,
        filename: fixtures.filename,
        file: Buffer.from("test-content"),
      });

      await expectMultipartUpload({
        endpoint: `/reports/${fixtures.report}/upload`,
        filename: fixtures.filename,
        content: "test-content",
      });
      expect(res).toBe(`${fixtures.reportUrl}${fixtures.filename}`);
    });

    it("should preserve protocol slashes in hrefs based on the created report URL", async () => {
      serviceClient = new AllureLegacyServiceClientClass({
        accessToken: fixtures.accessToken,
      });
      HttpClientMock.prototype.post.mockResolvedValue({ url: `http://localhost:3000/reports/${fixtures.report}/` });

      await serviceClient.createReport({
        reportName: fixtures.reportName,
        reportUuid: fixtures.report,
      });

      HttpClientMock.prototype.post.mockClear();
      HttpClientMock.prototype.post.mockResolvedValue({});

      const res = await serviceClient.addReportFile({
        reportUuid: fixtures.report,
        pluginId: "awesome",
        filename: "index.html",
        file: Buffer.from("test-content"),
      });

      await expectMultipartUpload({
        endpoint: `/reports/${fixtures.report}/upload`,
        filename: "awesome/index.html",
        content: "test-content",
      });
      expect(res).toBe(`http://localhost:3000/reports/${fixtures.report}/awesome/index.html`);
    });

    it("should fall back to the service URL when a report URL has not been created", async () => {
      serviceClient = new AllureLegacyServiceClientClass({
        accessToken: fixtures.accessToken,
      });
      HttpClientMock.prototype.post.mockResolvedValue({});

      const res = await serviceClient.addReportFile({
        reportUuid: fixtures.report,
        pluginId: fixtures.pluginId,
        filename: fixtures.filename,
        file: Buffer.from("test-content"),
      });

      await expectMultipartUpload({
        endpoint: `/reports/${fixtures.report}/upload`,
        filename: joinPosix(fixtures.pluginId, fixtures.filename),
        content: "test-content",
      });
      expect(res).toBe(`${fixtures.url}/${fixtures.report}/${fixtures.pluginId}/${fixtures.filename}`);
    });

    it("should throw an error if file size exceeds maximum", async () => {
      await expect(
        serviceClient.addReportFile({
          reportUuid: fixtures.report,
          filename: fixtures.filename,
          file: Buffer.alloc(201 * 1024 * 1024),
        }),
      ).rejects.toThrow("Report file size exceeds the maximum allowed size of 200MB");
    });
  });
});
