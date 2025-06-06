import { type HistoryDataPoint } from "@allurereport/core-api";
import { readFile } from "node:fs/promises";
import { join as joinPosix } from "node:path/posix";
import { type MockedFunction, beforeEach, describe, expect, it, vi } from "vitest";
import { type AllureService } from "../src/service.js";
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
  key: "key",
};

const open = await import("open");
const { AllureService: AllureServiceClass } = await import("../src/service.js");
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

describe("AllureService", () => {
  let service: AllureService;

  beforeEach(() => {
    vi.clearAllTimers();
    // vi.useFakeTimers();
    vi.clearAllMocks();

    service = new AllureServiceClass({ url: fixtures.url, project: fixtures.project, pollingDelay: 100 });
  });

  describe("login", () => {
    it("should create a new exchange token", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({ accessToken: fixtures.accessToken });

      await service.login();

      expect(writeExchangeToken).toHaveBeenCalled();
    });

    it("should open the connect url with the exchange token", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({ accessToken: fixtures.accessToken });

      await service.login();

      expect(open.default).toHaveBeenCalledWith(
        `https://service.allurereport.org/connect?token=${fixtures.decryptedToken}`,
      );
    });

    it("should write and return the retrieved access token", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({ accessToken: fixtures.accessToken });

      const result = await service.login();

      expect(writeAccessToken).toHaveBeenCalledWith(fixtures.accessToken);
      expect(result).toBe(fixtures.accessToken);
    });

    it("should return the access token", async () => {
      (decryptExchangeToken as MockedFunction<typeof decryptExchangeToken>).mockResolvedValue(fixtures.decryptedToken);

      HttpClientMock.prototype.post.mockResolvedValueOnce({ accessToken: undefined });
      HttpClientMock.prototype.post.mockResolvedValueOnce({ accessToken: undefined });
      HttpClientMock.prototype.post.mockResolvedValueOnce({ accessToken: undefined });
      HttpClientMock.prototype.post.mockResolvedValueOnce({ accessToken: fixtures.accessToken });

      const res = await service.login();

      expect(HttpClientMock.prototype.post).toHaveBeenCalledTimes(4);
      expect(res).toBe(fixtures.accessToken);
    });
  });

  describe("logout", () => {
    it("should delete the access token", async () => {
      await service.logout();

      expect(deleteAccessToken).toHaveBeenCalled();
    });
  });

  describe("profile", () => {
    it("should return the user profile", async () => {
      HttpClientMock.prototype.get.mockResolvedValue({ email: fixtures.email });

      const res = await service.profile();

      expect(res).toEqual({ email: fixtures.email });
    });
  });

  describe("projects", () => {
    it("should return the list of projects", async () => {
      HttpClientMock.prototype.get.mockResolvedValue([{ id: fixtures.project, name: fixtures.project }]);

      const res = await service.projects();

      expect(res).toEqual([{ id: fixtures.project, name: fixtures.project }]);
    });
  });

  describe("createProject", () => {
    it("should create a new project", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({ id: fixtures.project, name: fixtures.project });

      const res = await service.createProject({ name: fixtures.project });

      expect(res).toEqual({ id: fixtures.project, name: fixtures.project });
    });
  });

  describe("deleteProject", () => {
    it("should delete a project", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({ id: fixtures.project, name: fixtures.project });

      const res = await service.deleteProject({ name: fixtures.project });

      expect(res).toEqual({ id: fixtures.project, name: fixtures.project });
    });
  });

  describe("appendHistory", () => {
    it("should throw an error if the project is not set", async () => {
      service = new AllureServiceClass({ url: fixtures.url });

      // @ts-ignore
      await expect(service.appendHistory({ history: fixtures.history })).rejects.toThrow("Project is not set");
    });

    it("should append history data point", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({ id: fixtures.project, name: fixtures.project });

      const res = await service.appendHistory({ history: fixtures.history, branch: "main" });

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith("/api/history/append", {
        headers: {
          "Content-Type": "application/json",
        },
        body: {
          branch: "main",
          history: fixtures.history,
          project: fixtures.project,
        },
      });
      expect(res).toEqual({ id: fixtures.project, name: fixtures.project });
    });
  });

  describe("downloadHistory", () => {
    it("should throw an error if the project is not set", async () => {
      service = new AllureServiceClass({ url: fixtures.url });

      // @ts-ignore
      await expect(service.downloadHistory()).rejects.toThrow("Project is not set");
    });

    it("should download history", async () => {
      HttpClientMock.prototype.get.mockResolvedValue([fixtures.history]);

      const res = await service.downloadHistory({ branch: "main" });

      expect(HttpClientMock.prototype.get).toHaveBeenCalledWith("/api/history/download", {
        params: {
          project: fixtures.project,
          branch: "main",
        },
      });
      expect(res).toEqual([fixtures.history]);
    });
  });

  describe("createReport", () => {
    it("should throw an error if the project is not set", async () => {
      service = new AllureServiceClass({ url: fixtures.url });

      // @ts-ignore
      await expect(service.createReport({ name: fixtures.report })).rejects.toThrow("Project is not set");
    });

    it("should create a new report", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({ id: fixtures.report, name: fixtures.report });

      const res = await service.createReport({ reportName: fixtures.report, reportUuid: fixtures.report });

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith("/api/reports/create", {
        body: {
          id: fixtures.report,
          project: fixtures.project,
          name: fixtures.report,
        },
      });
      expect(res).toEqual({ id: fixtures.report, name: fixtures.report });
    });
  });

  describe("addReportFile", () => {
    it("should throw an error unless a file or filepath is provided", async () => {
      await expect(service.addReportFile({ reportUuid: fixtures.report, key: fixtures.key })).rejects.toThrow(
        "File or filepath is required",
      );
    });

    it("should throw an error if the provided filename points to a non-existing file", async () => {
      (readFile as MockedFunction<typeof readFile>).mockRejectedValue(new Error("File not found"));

      await expect(
        service.addReportFile({ reportUuid: fixtures.report, key: fixtures.key, filepath: "not-existing-file.txt" }),
      ).rejects.toThrow("File not found");
    });

    it("should upload a given file", async () => {
      HttpClientMock.prototype.post.mockResolvedValue({});

      const res = await service.addReportFile({
        reportUuid: fixtures.report,
        key: fixtures.key,
        file: Buffer.from("test"),
      });

      const form = new FormData();

      form.set("report", fixtures.report);
      form.set("filename", fixtures.key);
      form.set("file", Buffer.from("test") as unknown as Blob);

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith("/api/reports/upload", {
        body: form,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      expect(res).toEqual(joinPosix(fixtures.url, fixtures.report, fixtures.key));
    });
  });

  it("should upload a file from a filepath", async () => {
    (readFile as MockedFunction<typeof readFile>).mockResolvedValue(Buffer.from("test"));
    HttpClientMock.prototype.post.mockResolvedValue({});

    const res = await service.addReportFile({ reportUuid: fixtures.report, key: fixtures.key, filepath: "test.txt" });

    const form = new FormData();

    form.set("report", fixtures.report);
    form.set("filename", fixtures.key);
    form.set("file", Buffer.from("test") as unknown as Blob);

    expect(HttpClientMock.prototype.post).toHaveBeenCalledWith("/api/reports/upload", {
      body: form,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    expect(res).toEqual(joinPosix(fixtures.url, fixtures.report, fixtures.key));
  });
});
