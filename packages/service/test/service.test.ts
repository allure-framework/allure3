import { type HistoryDataPoint } from "@allurereport/core-api";
import { readFile } from "node:fs/promises";
import { join as joinPosix } from "node:path/posix";
import { type MockedFunction, beforeEach, describe, expect, it, vi } from "vitest";
import { type AllureServiceClient } from "../src/service.js";
import { HttpClientMock, createHttpClientMock } from "./utils.js";

const fixtures = {
  exchangeToken: "exchange-token",
  decryptedToken: "decrypted-token",
  accessToken: "access-token",
  project: "project",
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
  report: "report",
  filename: "filename",
  pluginId: "sample",
};

const open = await import("open");
const { AllureServiceClient: AllureServiceClientClass } = await import("../src/service.js");
const { writeExchangeToken, decryptExchangeToken, writeAccessToken, deleteAccessToken } = await import(
  "../src/utils/token.js"
);

vi.mock("open", () => ({
  default: vi.fn(),
}));
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));
vi.mock("../src/utils/http.js", async (importOriginal) => ({
  ...(await importOriginal()),
  createServiceHttpClient: createHttpClientMock,
}));
vi.mock("../src/utils/token.js", () => ({
  writeExchangeToken: vi.fn(async () => fixtures.exchangeToken),
  decryptExchangeToken: vi.fn(() => fixtures.decryptedToken),
  writeAccessToken: vi.fn(async () => {}),
  deleteAccessToken: vi.fn(async () => {}),
}));

describe("AllureServiceClient", () => {
  let serviceClient: AllureServiceClient;

  beforeEach(() => {
    vi.clearAllTimers();
    // vi.useFakeTimers();
    vi.clearAllMocks();

    serviceClient = new AllureServiceClientClass({ url: fixtures.url, project: fixtures.project, pollingDelay: 100 });
  });

  describe("login", () => {
    it("should create a new exchange token", async () => {
      HttpClientMock.prototype.get.mockResolvedValue({ url: fixtures.url });
      HttpClientMock.prototype.post.mockResolvedValue({ accessToken: fixtures.accessToken });

      await serviceClient.login();

      expect(writeExchangeToken).toHaveBeenCalled();
    });

    it("should open the connect url with the exchange token", async () => {
      HttpClientMock.prototype.get.mockResolvedValue({ url: fixtures.url });
      HttpClientMock.prototype.post.mockResolvedValue({ accessToken: fixtures.accessToken });

      await serviceClient.login();

      expect(open.default).toHaveBeenCalledWith(`${fixtures.url}/connect?token=${fixtures.decryptedToken}`);
    });

    it("should write and return the retrieved access token", async () => {
      HttpClientMock.prototype.get.mockResolvedValue({ url: fixtures.url });
      HttpClientMock.prototype.post.mockResolvedValue({ accessToken: fixtures.accessToken });

      const result = await serviceClient.login();

      expect(writeAccessToken).toHaveBeenCalledWith(fixtures.accessToken);
      expect(result).toBe(fixtures.accessToken);
    });

    it("should return the access token", async () => {
      (decryptExchangeToken as MockedFunction<typeof decryptExchangeToken>).mockResolvedValue(fixtures.decryptedToken);

      HttpClientMock.prototype.get.mockResolvedValue({ url: fixtures.url });
      HttpClientMock.prototype.post.mockResolvedValueOnce({ accessToken: undefined });
      HttpClientMock.prototype.post.mockResolvedValueOnce({ accessToken: undefined });
      HttpClientMock.prototype.post.mockResolvedValueOnce({ accessToken: undefined });
      HttpClientMock.prototype.post.mockResolvedValueOnce({ accessToken: fixtures.accessToken });

      const res = await serviceClient.login();

      expect(HttpClientMock.prototype.post).toHaveBeenCalledTimes(4);
      expect(res).toBe(fixtures.accessToken);
    });
  });

  describe("logout", () => {
    it("should delete the access token", async () => {
      await serviceClient.logout();

      expect(deleteAccessToken).toHaveBeenCalled();
    });
  });

  describe("profile", () => {
    it("should return the user profile", async () => {
      HttpClientMock.prototype.get.mockResolvedValue({ user: { email: fixtures.email } });

      const res = await serviceClient.profile();

      expect(res).toEqual({ email: fixtures.email });
    });
  });

  describe("projects", () => {
    it("should return the list of projects", async () => {
      HttpClientMock.prototype.get.mockResolvedValue({ projects: [{ id: fixtures.project, name: fixtures.project }] });

      const res = await serviceClient.projects();

      expect(res).toEqual({ projects: [{ id: fixtures.project, name: fixtures.project }] });
    });
  });

  describe("createProject", () => {
    it("should create a new project", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({ project: { id: fixtures.project, name: fixtures.project } });

      const res = await serviceClient.createProject({ name: fixtures.project });

      expect(res).toEqual({ id: fixtures.project, name: fixtures.project });
    });
  });

  describe("deleteProject", () => {
    it("should delete a project", async () => {
      HttpClientMock.prototype.delete.mockResolvedValue({ id: fixtures.project, name: fixtures.project });

      const res = await serviceClient.deleteProject({ id: fixtures.project });

      expect(res).toEqual({ id: fixtures.project, name: fixtures.project });
    });
  });

  describe("downloadHistory", () => {
    it("should throw an error if the project is not set", async () => {
      serviceClient = new AllureServiceClientClass({ url: fixtures.url });

      // @ts-ignore
      await expect(serviceClient.downloadHistory("main")).rejects.toThrow("Project is not set");
    });

    it("should download history", async () => {
      HttpClientMock.prototype.get.mockResolvedValue({ history: [fixtures.history] });

      const res = await serviceClient.downloadHistory({
        branch: "main",
      });

      expect(HttpClientMock.prototype.get).toHaveBeenCalledWith(`/projects/${fixtures.project}/main/history`);
      expect(res).toEqual([fixtures.history]);
    });

    it("should download history with a provided limit", async () => {
      HttpClientMock.prototype.get.mockResolvedValue({ history: [fixtures.history] });

      const res = await serviceClient.downloadHistory({
        branch: "main",
        limit: 10,
      });

      expect(HttpClientMock.prototype.get).toHaveBeenCalledWith(`/projects/${fixtures.project}/main/history?limit=10`);
      expect(res).toEqual([fixtures.history]);
    });
  });

  describe("createReport", () => {
    it("should throw an error if the project is not set", async () => {
      serviceClient = new AllureServiceClientClass({ url: fixtures.url });

      // @ts-ignore
      await expect(serviceClient.createReport({ reportName: fixtures.report })).rejects.toThrow("Project is not set");
    });

    it("should create a new report", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({ url: `${fixtures.url}/${fixtures.report}` });

      const res = await serviceClient.createReport({ reportName: fixtures.report, reportUuid: fixtures.report });

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith("/reports", {
        body: {
          branch: undefined,
          projectUuid: fixtures.project,
          reportUuid: fixtures.report,
          reportName: fixtures.report,
        },
      });
      expect(res).toEqual({ url: `${fixtures.url}/${fixtures.report}` });
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

      const res = await serviceClient.addReportFile({
        reportUuid: fixtures.report,
        pluginId: fixtures.pluginId,
        filename: fixtures.filename,
        file: Buffer.from("test"),
      });

      const form = new FormData();

      form.set("filename", joinPosix(fixtures.pluginId, fixtures.filename));
      form.set("file", Buffer.from("test") as unknown as Blob);

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith(`/reports/${fixtures.report}/upload`, {
        body: form,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      expect(res).toEqual(joinPosix(fixtures.url, fixtures.report, fixtures.filename));
    });

    it("should upload a file from a filepath", async () => {
      (readFile as MockedFunction<typeof readFile>).mockResolvedValue(Buffer.from("test"));
      HttpClientMock.prototype.post.mockResolvedValue({});

      const res = await serviceClient.addReportFile({
        reportUuid: fixtures.report,
        pluginId: fixtures.pluginId,
        filename: fixtures.filename,
        filepath: "test.txt",
      });

      const form = new FormData();

      form.set("filename", joinPosix(fixtures.pluginId, fixtures.filename));
      form.set("file", Buffer.from("test") as unknown as Blob);

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith(`/reports/${fixtures.report}/upload`, {
        body: form,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      expect(res).toEqual(joinPosix(fixtures.url, fixtures.report, fixtures.filename));
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

      const res = await serviceClient.addReportAsset({
        filename: fixtures.filename,
        file: Buffer.from("test"),
      });

      const form = new FormData();
      form.set("filename", fixtures.filename);
      form.set("file", Buffer.from("test") as unknown as Blob);

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith("/assets/upload", {
        body: form,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      expect(res).toEqual({});
    });

    it("should upload a file from a filepath", async () => {
      (readFile as MockedFunction<typeof readFile>).mockResolvedValue(Buffer.from("test"));
      HttpClientMock.prototype.post.mockResolvedValue({});

      const res = await serviceClient.addReportAsset({
        filename: fixtures.filename,
        filepath: "test.txt",
      });

      const form = new FormData();
      form.set("filename", fixtures.filename);
      form.set("file", Buffer.from("test") as unknown as Blob);

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith("/assets/upload", {
        body: form,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      expect(res).toEqual({});
    });
  });
});
