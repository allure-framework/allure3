import { type HistoryDataPoint } from "@allurereport/core-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllureRemoteHistory } from "../src/history.js";
import { type AllureService } from "../src/service.js";
import { HttpClientMock } from "./utils.js";

const { AllureService: AllureServiceClass } = await import("../src/service.js");

const fixtures = {
  project: "project",
  url: "https://service.allurereport.org",
  branch: "main",
  historyDataPoint: {
    uuid: "1",
    name: "test",
    timestamp: 0,
    knownTestCaseIds: [],
    testResults: {},
    url: "",
    metrics: {},
  } as HistoryDataPoint,
};

vi.mock("../src/utils/http.js", async (importOriginal) => {
  const { createHttpClientMock } = await import("./utils.js");

  return {
    ...(await importOriginal()),
    createServiceHttpClient: createHttpClientMock,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AllureRemoteHistory", () => {
  let service: AllureService;
  let history: AllureRemoteHistory;

  beforeEach(() => {
    service = new AllureServiceClass({ url: fixtures.url, project: fixtures.project });
    history = new AllureRemoteHistory(service);
  });

  describe("readHistory", () => {
    it("should return resolved history data", async () => {
      HttpClientMock.prototype.get.mockResolvedValue([
        {
          uuid: "1",
          name: "test",
          timestamp: 0,
          knownTestCaseIds: [],
          testResults: {},
          url: "",
          metrics: {},
        },
      ]);

      const result = await history.readHistory(fixtures.branch);
      expect(HttpClientMock.prototype.get).toHaveBeenCalledWith("/api/history/download", {
        params: {
          branch: fixtures.branch,
          project: fixtures.project,
        },
      });
      expect(result).toEqual([fixtures.historyDataPoint]);
    });
  });

  describe("appendHistory", () => {
    it("should call service.appendHistory with correct params", async () => {
      await history.appendHistory(fixtures.historyDataPoint, fixtures.branch);

      expect(HttpClientMock.prototype.post).toHaveBeenCalledWith("/api/history/append", {
        body: {
          history: fixtures.historyDataPoint,
          branch: fixtures.branch,
          project: fixtures.project,
        },
        headers: {
          "Content-Type": "application/json",
        },
      });
    });
  });
});
