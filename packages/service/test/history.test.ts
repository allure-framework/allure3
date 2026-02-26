import { type HistoryDataPoint } from "@allurereport/core-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllureRemoteHistory } from "../src/history.js";
import { type AllureServiceClient } from "../src/service.js";
import { KnownError } from "../src/utils/http.js";
import { HttpClientMock } from "./utils.js";

const { AllureServiceClient: AllureServiceClientClass } = await import("../src/service.js");

// Static JWT token fixture
// JWT payload: { "iss": "allure-service", "url": "https://service.allurereport.org", "projectId": "test-project-id" }
const validAccessToken =
  "header.eyJpc3MiOiJhbGx1cmUtc2VydmljZSIsInVybCI6Imh0dHBzOi8vc2VydmljZS5hbGx1cmVyZXBvcnQub3JnIiwicHJvamVjdElkIjoidGVzdC1wcm9qZWN0LWlkIn0.signature";

const fixtures = {
  accessToken: validAccessToken,
  project: "test-project-id",
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
    serviceClient = new AllureServiceClientClass({ accessToken: fixtures.accessToken });
    history = new AllureRemoteHistory({
      allureServiceClient: serviceClient,
      branch: fixtures.branch,
    });
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

      const result = await history.readHistory();

      expect(HttpClientMock.prototype.get).toHaveBeenCalledWith(
        `/projects/history?branch=${encodeURIComponent(fixtures.branch)}`,
      );
      expect(result).toEqual([fixtures.historyDataPoint]);
    });

    it("should return resolved history data with a limit set in the constructor", async () => {
      history = new AllureRemoteHistory({
        allureServiceClient: serviceClient,
        branch: fixtures.branch,
        limit: 10,
      });

      HttpClientMock.prototype.get.mockResolvedValue({ history: [fixtures.historyDataPoint] });

      const result = await history.readHistory();

      expect(HttpClientMock.prototype.get).toHaveBeenCalledWith(
        `/projects/history?limit=10&branch=${encodeURIComponent(fixtures.branch)}`,
      );
      expect(result).toEqual([fixtures.historyDataPoint]);
    });

    it("should override the constructor branch via the method argument", async () => {
      HttpClientMock.prototype.get.mockResolvedValue({ history: [fixtures.historyDataPoint] });

      const result = await history.readHistory({ branch: "feature" });

      expect(HttpClientMock.prototype.get).toHaveBeenCalledWith(
        `/projects/history?branch=${encodeURIComponent("feature")}`,
      );
      expect(result).toEqual([fixtures.historyDataPoint]);
    });

    it("should call without branch param if branch is not provided", async () => {
      const historyWithoutBranch = new AllureRemoteHistory({
        allureServiceClient: serviceClient,
      });

      HttpClientMock.prototype.get.mockResolvedValue({ history: [] });

      const result = await historyWithoutBranch.readHistory();

      expect(HttpClientMock.prototype.get).toHaveBeenCalledWith("/projects/history");
      expect(result).toEqual([]);
    });

    it("should return empty array if history is not found", async () => {
      HttpClientMock.prototype.get.mockRejectedValue(new KnownError("History not found", 404));

      const result = await history.readHistory();

      expect(result).toEqual([]);
    });

    it("should throw another unexpected errors", async () => {
      HttpClientMock.prototype.get.mockRejectedValue(new Error("Unexpected error"));

      await expect(history.readHistory()).rejects.toThrow("Unexpected error");
    });
  });

  describe("appendHistory", () => {
    it("should be a no-op method", async () => {
      const result = await history.appendHistory();

      expect(result).toBeUndefined();
      expect(HttpClientMock.prototype.get).not.toHaveBeenCalled();
      expect(HttpClientMock.prototype.post).not.toHaveBeenCalled();
    });
  });
});
