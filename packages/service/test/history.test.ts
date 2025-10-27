import { type HistoryDataPoint } from "@allurereport/core-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllureRemoteHistory } from "../src/history.js";
import { type AllureServiceClient } from "../src/service.js";
import { KnownError } from "../src/utils/http.js";
import { HttpClientMock } from "./utils.js";

const { AllureServiceClient: AllureServiceClientClass } = await import("../src/service.js");

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
    status: "passed",
    stage: "test",
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
  let serviceClient: AllureServiceClient;
  let history: AllureRemoteHistory;

  beforeEach(() => {
    serviceClient = new AllureServiceClientClass({ url: fixtures.url, project: fixtures.project });
    history = new AllureRemoteHistory(serviceClient);
  });

  describe("readHistory", () => {
    it("should return resolved history data", async () => {
      HttpClientMock.prototype.get.mockResolvedValue({
        history: [
          {
            uuid: "1",
            name: "test",
            timestamp: 0,
            knownTestCaseIds: [],
            testResults: {},
            url: "",
            metrics: {},
            status: "passed",
            stage: "test",
          },
        ],
      });

      const result = await history.readHistory(fixtures.branch);

      expect(HttpClientMock.prototype.get).toHaveBeenCalledWith(
        `/projects/${fixtures.project}/${fixtures.branch}/history`,
      );
      expect(result).toEqual([fixtures.historyDataPoint]);
    });

    it("should return empty array if history is not found", async () => {
      HttpClientMock.prototype.get.mockRejectedValue(new KnownError("History not found", 404));

      const result = await history.readHistory(fixtures.branch);

      expect(result).toEqual([]);
    });

    it("should throw another unexpected errors", async () => {
      HttpClientMock.prototype.get.mockRejectedValue(new Error("Unexpected error"));

      await expect(history.readHistory(fixtures.branch)).rejects.toThrow("Unexpected error");
    });
  });

  describe("appendHistory", () => {
    it("should be a no-op method", async () => {
      const result = await history.appendHistory();

      expect(result).toBeUndefined();
      expect(HttpClientMock.prototype.post).not.toHaveBeenCalled();
    });
  });
});
