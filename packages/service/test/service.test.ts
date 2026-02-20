import type { HistoryDataPoint } from "@allurereport/core-api";
import { readFile } from "node:fs/promises";
import { join as joinPosix } from "node:path/posix";
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
  branch: "main",
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
      accessToken: fixtures.accessToken,
    });
  });

  describe("constructor", () => {
    it("should throw an error if access token is not provided", () => {
      expect(() => new AllureServiceClientClass({})).toThrow("Allure service access token is required");
    });

    it("should throw an error if access token is invalid", () => {
      expect(() => new AllureServiceClientClass({ accessToken: invalidIssuerToken })).toThrow("Invalid access token");
    });

    it("should throw an error if access token has wrong format", () => {
      expect(() => new AllureServiceClientClass({ accessToken: "invalid-token" })).toThrow("Invalid access token");
    });

    it("should successfully create client with valid access token", () => {
      expect(() => new AllureServiceClientClass({ accessToken: validAccessToken })).not.toThrow();
    });
  });

  describe("decodeToken", () => {
    it("should decode a valid JWT token", () => {
      const decoded = serviceClient.decodeToken(validAccessToken);

      expect(decoded).toEqual({
        iss: "allure-service",
        url: "https://service.allurereport.org",
        projectId: "test-project-id",
      });
    });

    it("should return undefined for invalid token", () => {
      const decoded = serviceClient.decodeToken("not-a-valid-jwt");

      expect(decoded).toBeUndefined();
    });
  });

  describe("profile", () => {
    it("should return the user profile and project", async () => {
      HttpClientMock.prototype.get.mockResolvedValue({
        user: { email: fixtures.email },
        project: { id: fixtures.project, name: "Test Project" },
      });

      const res = await serviceClient.profile();

      expect(HttpClientMock.prototype.get).toHaveBeenCalledWith("/user/profile");
      expect(res).toEqual({
        user: { email: fixtures.email },
        project: { id: fixtures.project, name: "Test Project" },
      });
    });
  });

  describe("generateNewAccessToken", () => {
    it("should generate a new access token for a project", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({ accessToken: fixtures.newAccessToken });

      const res = await serviceClient.generateNewAccessToken(fixtures.project);

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith("/auth/tokens", {
        body: {
          projectId: fixtures.project,
        },
      });
      expect(res).toBe(fixtures.newAccessToken);
    });
  });

  describe("projects", () => {
    it("should return the list of projects", async () => {
      const projectsList = {
        projects: [
          { id: "project-1", name: "Project 1" },
          { id: "project-2", name: "Project 2" },
        ],
      };

      HttpClientMock.prototype.get.mockResolvedValue(projectsList);

      const res = await serviceClient.projects();

      expect(HttpClientMock.prototype.get).toHaveBeenCalledWith("/projects");
      expect(res).toEqual(projectsList);
    });
  });

  describe("project", () => {
    it("should return a specific project by UUID", async () => {
      const projectData = { project: { id: fixtures.project, name: "Test Project" } };

      HttpClientMock.prototype.get.mockResolvedValue(projectData);

      const res = await serviceClient.project(fixtures.project);

      expect(HttpClientMock.prototype.get).toHaveBeenCalledWith(`/projects/${fixtures.project}`);
      expect(res).toEqual(projectData);
    });
  });

  describe("downloadHistory", () => {
    it("should download history for a branch", async () => {
      HttpClientMock.prototype.get.mockResolvedValue({ history: [fixtures.history] });

      const res = await serviceClient.downloadHistory({
        branch: fixtures.branch,
      });

      expect(HttpClientMock.prototype.get).toHaveBeenCalledWith(
        `/projects/history?branch=${encodeURIComponent(fixtures.branch)}`,
      );
      expect(res).toEqual([fixtures.history]);
    });

    it("should download history with a provided limit", async () => {
      HttpClientMock.prototype.get.mockResolvedValue({ history: [fixtures.history] });

      const res = await serviceClient.downloadHistory({
        branch: fixtures.branch,
        limit: 10,
      });

      expect(HttpClientMock.prototype.get).toHaveBeenCalledWith(
        `/projects/history?limit=10&branch=${encodeURIComponent(fixtures.branch)}`,
      );
      expect(res).toEqual([fixtures.history]);
    });

    it("should encode branch name in URL", async () => {
      HttpClientMock.prototype.get.mockResolvedValue({ history: [] });

      await serviceClient.downloadHistory({
        branch: "feature/test-branch",
      });

      expect(HttpClientMock.prototype.get).toHaveBeenCalledWith(
        `/projects/history?branch=${encodeURIComponent(encodeURIComponent("feature/test-branch"))}`,
      );
    });
  });

  describe("createReport", () => {
    it("should create a new report", async () => {
      const reportUrl = { url: `${fixtures.url}/${fixtures.report}` };

      HttpClientMock.prototype.post.mockResolvedValue(reportUrl);

      const res = await serviceClient.createReport({
        reportName: fixtures.reportName,
        reportUuid: fixtures.report,
        branch: fixtures.branch,
      });

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith("/reports", {
        body: {
          reportName: fixtures.reportName,
          reportUuid: fixtures.report,
          branch: fixtures.branch,
        },
      });
      expect(res).toEqual(reportUrl);
    });

    it("should create a report without branch", async () => {
      const reportUrl = { url: `${fixtures.url}/${fixtures.report}` };

      HttpClientMock.prototype.post.mockResolvedValue(reportUrl);

      const res = await serviceClient.createReport({
        reportName: fixtures.reportName,
      });

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith("/reports", {
        body: {
          reportName: fixtures.reportName,
          reportUuid: undefined,
          branch: undefined,
        },
      });
      expect(res).toEqual(reportUrl);
    });
  });

  describe("completeReport", () => {
    it("should mark report as completed with history point", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({});

      const res = await serviceClient.completeReport({
        reportUuid: fixtures.report,
        historyPoint: fixtures.history,
      });

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith(`/reports/${fixtures.report}/complete`, {
        body: {
          historyPoint: fixtures.history,
        },
      });
      expect(res).toEqual({});
    });
  });

  describe("deleteReport", () => {
    it("should delete a report", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({});

      const res = await serviceClient.deleteReport({
        reportUuid: fixtures.report,
      });

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith(`/reports/${fixtures.report}/delete`, {
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

    it("should upload a given file", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({});

      const fileBuffer = Buffer.from("test-content");
      const res = await serviceClient.addReportAsset({
        filename: fixtures.filename,
        file: fileBuffer,
      });
      const form = new FormData();

      form.set("filename", fixtures.filename);
      form.set("file", fileBuffer as unknown as Blob);

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith("/assets/upload", {
        body: form,
        headers: {
          "Content-Type": "multipart/form-data",
        },
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

      const form = new FormData();
      form.set("filename", fixtures.filename);
      form.set("file", fileBuffer);

      expect(readFile).toHaveBeenCalledWith("test.txt");
      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith("/assets/upload", {
        body: form,
        headers: {
          "Content-Type": "multipart/form-data",
        },
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
      const form = new FormData();

      form.set("filename", joinPosix(fixtures.pluginId, fixtures.filename));
      form.set("file", fileBuffer);

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith(`/reports/${fixtures.report}/upload`, {
        body: form,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      expect(res).toEqual(joinPosix(fixtures.url, fixtures.report, fixtures.filename));
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
      const form = new FormData();

      form.set("filename", joinPosix(fixtures.pluginId, fixtures.filename));
      form.set("file", fileBuffer as unknown as Blob);

      expect(readFile).toHaveBeenCalledWith("test.txt");
      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith(`/reports/${fixtures.report}/upload`, {
        body: form,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      expect(res).toEqual(joinPosix(fixtures.url, fixtures.report, fixtures.filename));
    });

    it("should upload a file without plugin ID", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({});

      const fileBuffer = Buffer.from("test-content");
      const res = await serviceClient.addReportFile({
        reportUuid: fixtures.report,
        filename: fixtures.filename,
        file: fileBuffer,
      });
      const form = new FormData();

      form.set("filename", fixtures.filename);
      form.set("file", fileBuffer as unknown as Blob);

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith(`/reports/${fixtures.report}/upload`, {
        body: form,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      expect(res).toEqual(joinPosix(fixtures.url, fixtures.report, fixtures.filename));
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
