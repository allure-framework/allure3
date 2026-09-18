import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";

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

const expectRawUpload = (expected: { endpoint: string; body: unknown; size: number; signal?: AbortSignal }) => {
  expect(HttpClientMock.prototype.put).toHaveBeenLastCalledWith(expected.endpoint, {
    body: expected.body,
    headers: {
      "Content-Length": expected.size,
      "Content-Type": "application/octet-stream",
    },
    maxBodyLength: Number.POSITIVE_INFINITY,
    maxContentLength: Number.POSITIVE_INFINITY,
    ...(expected.signal ? { signal: expected.signal } : {}),
  });
};

const { AllureServiceClient: AllureServiceClientClass } = await import("../src/service.js");

vi.mock("node:fs", () => ({
  createReadStream: vi.fn(),
}));
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  stat: vi.fn(),
}));
vi.mock("../src/utils/http.js", async (importOriginal) => ({
  ...(await importOriginal()),
  createServiceHttpClient: createHttpClientMock,
}));

describe("AllureServiceClient", () => {
  let serviceClient: AllureServiceClient;

  beforeEach(() => {
    vi.clearAllMocks();
    (stat as MockedFunction<typeof stat>).mockResolvedValue({ size: 12 } as never);

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
          repo: fixtures.repo,
          branch: fixtures.branch,
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
          limit: 10,
          repo: fixtures.repo,
          branch: fixtures.branch,
        },
      });
      expect(res).toEqual([fixtures.history]);
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
      HttpClientMock.prototype.put.mockResolvedValue({});

      const fileBuffer = Buffer.from("test-content");
      const res = await serviceClient.addReportAsset({
        filename: fixtures.filename,
        file: fileBuffer,
      });

      expectRawUpload({
        endpoint: "/api/assets?path=data.json",
        body: fileBuffer,
        size: fileBuffer.length,
      });
      expect(res).toEqual({});
    });

    it("should upload a file from a filepath", async () => {
      const stream = { destroy: vi.fn() };
      (createReadStream as MockedFunction<typeof createReadStream>).mockReturnValue(stream as never);
      HttpClientMock.prototype.put.mockResolvedValue({});

      const res = await serviceClient.addReportAsset({
        filename: fixtures.filename,
        filepath: "test.txt",
      });

      expect(readFile).not.toHaveBeenCalled();
      expect(stat).toHaveBeenCalledWith("test.txt");
      expect(createReadStream).toHaveBeenCalledWith("test.txt", { signal: undefined });
      expectRawUpload({
        endpoint: "/api/assets?path=data.json",
        body: stream,
        size: 12,
      });
      expect(stream.destroy).toHaveBeenCalled();
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
      HttpClientMock.prototype.put.mockResolvedValue({});

      const fileBuffer = Buffer.from("test-content");
      const res = await serviceClient.addReportFile({
        reportUuid: fixtures.report,
        pluginId: fixtures.pluginId,
        filename: fixtures.filename,
        file: fileBuffer,
      });

      expectRawUpload({
        endpoint: `/api/reports/${fixtures.report}/files?path=sample%2Fdata.json`,
        body: fileBuffer,
        size: fileBuffer.length,
      });
      expect(res).toEqual(`${fixtures.url}/${fixtures.report}/${fixtures.pluginId}/${fixtures.filename}`);
    });

    it("should upload a file from a filepath", async () => {
      const stream = { destroy: vi.fn() };
      (createReadStream as MockedFunction<typeof createReadStream>).mockReturnValue(stream as never);
      HttpClientMock.prototype.put.mockResolvedValue({});

      const res = await serviceClient.addReportFile({
        reportUuid: fixtures.report,
        pluginId: fixtures.pluginId,
        filename: fixtures.filename,
        filepath: "test.txt",
      });

      expect(readFile).not.toHaveBeenCalled();
      expect(stat).toHaveBeenCalledWith("test.txt");
      expectRawUpload({
        endpoint: `/api/reports/${fixtures.report}/files?path=sample%2Fdata.json`,
        body: stream,
        size: 12,
      });
      expect(stream.destroy).toHaveBeenCalled();
      expect(res).toEqual(`${fixtures.url}/${fixtures.report}/${fixtures.pluginId}/${fixtures.filename}`);
    });

    it("should stream a 45 MiB filesystem file without materializing it", async () => {
      const size = 45 * 1024 * 1024;
      const stream = { destroy: vi.fn() };
      (stat as MockedFunction<typeof stat>).mockResolvedValue({ size } as never);
      (createReadStream as MockedFunction<typeof createReadStream>).mockReturnValue(stream as never);
      HttpClientMock.prototype.put.mockResolvedValue({});

      await serviceClient.addReportFile({
        reportUuid: fixtures.report,
        pluginId: fixtures.pluginId,
        filename: "large.bin",
        filepath: "large.bin",
      });

      expect(readFile).not.toHaveBeenCalled();
      expect(createReadStream).toHaveBeenCalledWith("large.bin", { signal: undefined });
      expectRawUpload({
        endpoint: `/api/reports/${fixtures.report}/files?path=sample%2Flarge.bin`,
        body: stream,
        size,
      });
      expect(stream.destroy).toHaveBeenCalled();
    });

    it("should destroy the filesystem stream when the request is cancelled", async () => {
      const controller = new AbortController();
      const stream = { destroy: vi.fn() };
      (createReadStream as MockedFunction<typeof createReadStream>).mockReturnValue(stream as never);
      HttpClientMock.prototype.put.mockImplementation(
        async (_endpoint: string, payload: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            payload.signal.addEventListener("abort", () => reject(payload.signal.reason), { once: true });
          }),
      );
      const upload = serviceClient.addReportFile({
        reportUuid: fixtures.report,
        filename: fixtures.filename,
        filepath: "test.txt",
        signal: controller.signal,
      });

      await vi.waitFor(() => expect(HttpClientMock.prototype.put).toHaveBeenCalledTimes(1));
      controller.abort(new Error("cancelled"));

      await expect(upload).rejects.toThrow("cancelled");
      expect(stream.destroy).toHaveBeenCalled();
    });

    it("should upload a file without plugin ID", async () => {
      HttpClientMock.prototype.put.mockResolvedValue({});

      const fileBuffer = Buffer.from("test-content");
      const res = await serviceClient.addReportFile({
        reportUuid: fixtures.report,
        filename: fixtures.filename,
        file: fileBuffer,
      });

      expectRawUpload({
        endpoint: `/api/reports/${fixtures.report}/files?path=data.json`,
        body: fileBuffer,
        size: fileBuffer.length,
      });
      expect(res).toEqual(`${fixtures.url}/${fixtures.report}/${fixtures.filename}`);
    });

    it("should preserve the URL protocol slashes in uploaded file hrefs", async () => {
      serviceClient = new AllureServiceClientClass({
        ...uploadConfig,
        accessToken: createAccessToken({ accessToken: fixtures.serviceAccessToken, url: "http://localhost:3000/" }),
      });
      HttpClientMock.prototype.put.mockResolvedValue({});

      const res = await serviceClient.addReportFile({
        reportUuid: fixtures.report,
        pluginId: "awesome",
        filename: "index.html",
        file: Buffer.from("test-content"),
      });

      expectRawUpload({
        endpoint: `/api/reports/${fixtures.report}/files?path=awesome%2Findex.html`,
        body: expect.any(Buffer),
        size: 12,
      });
      expect(res).toEqual(`http://localhost:3000/${fixtures.report}/awesome/index.html`);
    });
  });

  describe("uploadReport", () => {
    it.each([0, 0.5, -1])("rejects upload concurrency that resolves to %s or less", async (uploadConcurrency) => {
      serviceClient = new AllureServiceClientClass({
        ...uploadConfig,
        accessToken: fixtures.accessToken,
        uploadConcurrency,
      });

      await expect(
        serviceClient.uploadReport({
          reportUuid: fixtures.report,
          files: {
            "index.html": "index.html",
          },
        }),
      ).rejects.toThrow(
        `Allure service upload concurrency must resolve to an integer greater than 0; received ${uploadConcurrency}`,
      );

      expect(stat).not.toHaveBeenCalled();
      expect(HttpClientMock.prototype.put).not.toHaveBeenCalled();
    });

    it("uploads files through shared helper", async () => {
      const stream = { destroy: vi.fn() };
      (createReadStream as MockedFunction<typeof createReadStream>).mockReturnValue(stream as never);
      HttpClientMock.prototype.put.mockResolvedValue(undefined);

      const result = await serviceClient.uploadReport({
        reportUuid: fixtures.report,
        pluginId: fixtures.pluginId,
        files: {
          "index.html": "index.html",
        },
      });

      expect(result.indexHref).toBe(`${fixtures.url}/${fixtures.report}/${fixtures.pluginId}/index.html`);
      expect(HttpClientMock.prototype.put).toHaveBeenCalledWith(
        `/api/reports/${fixtures.report}/files?path=sample%2Findex.html`,
        expect.anything(),
      );
    });
  });
});
