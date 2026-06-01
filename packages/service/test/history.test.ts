import { type HistoryDataPoint } from "@allurereport/core-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AllureRemoteHistory } from "../src/history.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("history");
  await story("history");
  await label("coverage", "history");
});
import { type AllureServiceClient } from "../src/service.js";
import { KnownError } from "../src/utils/http.js";
import { HttpClientMock } from "./utils.js";

const { AllureServiceClient: AllureServiceClientClass } = await import("../src/service.js");

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
  project: "test-project-id",
  url: serviceUrl,
  repo: "allure3",
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
    serviceClient = new AllureServiceClientClass({ ...uploadConfig, accessToken: fixtures.accessToken });
    history = new AllureRemoteHistory({
      allureServiceClient: serviceClient,
      repo: fixtures.repo,
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

      expect(HttpClientMock.prototype.get).toHaveBeenCalledWith("/api/history", {
        params: {
          limit: undefined,
          repo: encodeURIComponent(fixtures.repo),
          branch: encodeURIComponent(fixtures.branch),
        },
      });
      expect(result).toEqual([fixtures.historyDataPoint]);
    });

    it("should normalize nested history test result url from datapoint url", async () => {
      HttpClientMock.prototype.get.mockResolvedValue({
        history: [
          {
            ...fixtures.historyDataPoint,
            url: fixtures.url,
            testResults: {
              primary: {
                id: "history-id",
                name: "history-name",
                status: "passed",
                url: "",
              },
            },
          },
        ],
      });

      const [historyPoint] = await history.readHistory();

      expect(historyPoint.testResults.primary.url).toBe(fixtures.url);
    });

    it("should return resolved history data with a limit set in the constructor", async () => {
      history = new AllureRemoteHistory({
        allureServiceClient: serviceClient,
        repo: fixtures.repo,
        branch: fixtures.branch,
        limit: 10,
      });

      HttpClientMock.prototype.get.mockResolvedValue({ history: [fixtures.historyDataPoint] });

      const result = await history.readHistory();

      expect(HttpClientMock.prototype.get).toHaveBeenCalledWith("/api/history", {
        params: {
          limit: "10",
          repo: encodeURIComponent(fixtures.repo),
          branch: encodeURIComponent(fixtures.branch),
        },
      });
      expect(result).toEqual([fixtures.historyDataPoint]);
    });

    it("should override the constructor branch via the method argument", async () => {
      HttpClientMock.prototype.get.mockResolvedValue({ history: [fixtures.historyDataPoint] });

      const result = await history.readHistory({ branch: "feature" });

      expect(HttpClientMock.prototype.get).toHaveBeenCalledWith("/api/history", {
        params: {
          limit: undefined,
          repo: encodeURIComponent(fixtures.repo),
          branch: encodeURIComponent("feature"),
        },
      });
      expect(result).toEqual([fixtures.historyDataPoint]);
    });

    it("should override the constructor repository via the method argument", async () => {
      HttpClientMock.prototype.get.mockResolvedValue({ history: [fixtures.historyDataPoint] });

      const result = await history.readHistory({ repo: "other-repo", branch: "feature" });

      expect(HttpClientMock.prototype.get).toHaveBeenCalledWith("/api/history", {
        params: {
          limit: undefined,
          repo: encodeURIComponent("other-repo"),
          branch: encodeURIComponent("feature"),
        },
      });
      expect(result).toEqual([fixtures.historyDataPoint]);
    });

    it("should call without branch param if branch is not provided", async () => {
      const historyWithoutBranch = new AllureRemoteHistory({
        allureServiceClient: serviceClient,
      });

      HttpClientMock.prototype.get.mockResolvedValue({ history: [] });

      const result = await historyWithoutBranch.readHistory();

      expect(HttpClientMock.prototype.get).toHaveBeenCalledWith("/api/history", {
        params: {
          limit: undefined,
          repo: undefined,
          branch: undefined,
        },
      });
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
