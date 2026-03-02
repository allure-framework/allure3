import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { StaticReportClient, ApiReportClient } from "../src/reportDataClient.js";
import { ReportFetchError, clearReportClientCache, getReportClient } from "../src/data.js";
import * as apiReportClient from "../src/apiReportClient.js";

describe("reportDataClient", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    clearReportClientCache();
    (globalThis as unknown as { allureReportOptions?: unknown }).allureReportOptions = undefined;
  });

  describe("StaticReportClient", () => {
    test("getJson resolves URL via resolver, fetches and returns parsed JSON as T", async () => {
      const payload = { total: 10, passed: 8 };
      const resolveUrl = vi.fn().mockResolvedValue("https://example.com/widgets/statistic.json");
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(payload),
      });
      vi.stubGlobal("fetch", mockFetch);

      const client = new StaticReportClient(resolveUrl);
      const result = await client.getJson<{ total: number; passed: number }>("widgets/statistic.json");

      expect(resolveUrl).toHaveBeenCalledWith("widgets/statistic.json", "application/json", undefined);
      expect(mockFetch).toHaveBeenCalledWith("https://example.com/widgets/statistic.json");
      expect(result).toEqual(payload);
    });

    test("getJson passes bustCache params to resolver", async () => {
      const resolveUrl = vi.fn().mockResolvedValue("https://example.com/data.json");
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));

      const client = new StaticReportClient(resolveUrl);
      await client.getJson("widgets/statistic.json", { bustCache: true });

      expect(resolveUrl).toHaveBeenCalledWith("widgets/statistic.json", "application/json", { bustCache: true });
    });

    test("getJson throws when response is not ok (default Error)", async () => {
      const resolveUrl = vi.fn().mockResolvedValue("https://example.com/404.json");
      const res = new Response("Not Found", { status: 404 });
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res));

      const client = new StaticReportClient(resolveUrl);

      await expect(client.getJson("widgets/missing.json")).rejects.toThrow(
        "Failed to fetch https://example.com/404.json, response status: 404",
      );
    });

    test("getJson throws ReportFetchError when createFetchError is provided", async () => {
      const resolveUrl = vi.fn().mockResolvedValue("https://example.com/500.json");
      const res = new Response("Server Error", { status: 500 });
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res));

      const client = new StaticReportClient(resolveUrl, (msg, r) => new ReportFetchError(msg, r));

      await expect(client.getJson("widgets/error.json")).rejects.toThrow(ReportFetchError);
      try {
        await client.getJson("widgets/error.json");
      } catch (e) {
        expect((e as ReportFetchError).response).toBe(res);
      }
    });

    test("getAttachment resolves URL and returns fetch Response", async () => {
      const resolveUrl = vi.fn().mockResolvedValue("https://example.com/attachments/abc");
      const mockRes = new Response(new Blob(), { headers: { "Content-Type": "image/png" } });
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockRes));

      const client = new StaticReportClient(resolveUrl);
      const result = await client.getAttachment("attachments/abc", "image/png");

      expect(resolveUrl).toHaveBeenCalledWith("attachments/abc", "image/png");
      expect(result).toBe(mockRes);
    });
  });

  describe("ApiReportClient", () => {
    test("getJson returns [] for widgets/environments.json when no launchId", async () => {
      const fetchSpy = vi.spyOn(apiReportClient, "fetchReportJsonFromApi").mockResolvedValue([]);

      (globalThis as unknown as { allureReportOptions?: { apiBaseUrl: string; launchId?: string } }).allureReportOptions =
        { apiBaseUrl: "http://localhost:3000" };

      const client = new ApiReportClient();
      const result = await client.getJson<string[]>("widgets/environments.json");

      expect(result).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    test("getJson calls fetchReportJsonFromApi for widgets/environments.json when launchId exists", async () => {
      const envIds = ["env-id-1", "env-id-2"];
      vi.spyOn(apiReportClient, "fetchReportJsonFromApi").mockResolvedValue(envIds);

      (globalThis as unknown as { allureReportOptions?: { apiBaseUrl: string; launchId?: string } }).allureReportOptions =
        { apiBaseUrl: "http://localhost:3000", launchId: "launch-1" };

      const client = new ApiReportClient();
      const result = await client.getJson<string[]>("widgets/environments.json");

      expect(result).toEqual(envIds);
      expect(apiReportClient.fetchReportJsonFromApi).toHaveBeenCalledWith("widgets/environments.json", {
        launchId: "launch-1",
      });
    });

    test("getJson returns [] for path widgets/environments/foo.json when no URL mapping", async () => {
      (globalThis as unknown as { allureReportOptions?: { apiBaseUrl: string; launchId?: string } }).allureReportOptions =
        { apiBaseUrl: "http://localhost:3000", launchId: "launch-1" };

      const client = new ApiReportClient();
      const result = await client.getJson<string[]>("widgets/environments/foo.json");

      expect(result).toEqual([]);
    });

    test("getJson delegates to fetchReportJsonFromApi for non-environments path", async () => {
      const stat = { total: 20, passed: 15, failed: 2 };
      vi.spyOn(apiReportClient, "fetchReportJsonFromApi").mockResolvedValue(stat);

      (globalThis as unknown as { allureReportOptions?: { apiBaseUrl: string; launchId: string } }).allureReportOptions =
        { apiBaseUrl: "http://localhost:3000", launchId: "launch-123" };

      const client = new ApiReportClient();
      const result = await client.getJson<{ total: number }>("widgets/statistic.json");

      expect(result).toEqual(stat);
      expect(apiReportClient.fetchReportJsonFromApi).toHaveBeenCalledWith("widgets/statistic.json", {
        launchId: "launch-123",
      });
    });

    test("getAttachment delegates to fetchReportAttachmentFromApi", async () => {
      const mockRes = new Response();
      vi.spyOn(apiReportClient, "fetchReportAttachmentFromApi").mockResolvedValue(mockRes);

      (globalThis as unknown as { allureReportOptions?: { apiBaseUrl: string } }).allureReportOptions = {
        apiBaseUrl: "http://localhost:3000",
      };

      const client = new ApiReportClient();
      const result = await client.getAttachment("attachments/uid-1");

      expect(result).toBe(mockRes);
      expect(apiReportClient.fetchReportAttachmentFromApi).toHaveBeenCalledWith("attachments/uid-1");
    });
  });

  describe("getReportClient", () => {
    test("returns ApiReportClient when allureReportOptions.apiBaseUrl is set", async () => {
      vi.spyOn(apiReportClient, "fetchReportJsonFromApi").mockResolvedValue(["env-1", "env-2"]);

      (globalThis as unknown as { allureReportOptions?: { apiBaseUrl: string; launchId?: string } }).allureReportOptions =
        { apiBaseUrl: "http://localhost:3000", launchId: "l1" };

      const client = getReportClient();
      const env = await client.getJson<string[]>("widgets/environments.json");

      expect(env).toEqual(["env-1", "env-2"]);
      expect(client).toBeInstanceOf(ApiReportClient);
    });

    test("returns StaticReportClient when apiBaseUrl is not set", async () => {
      (globalThis as unknown as { allureReportOptions?: unknown }).allureReportOptions = {};

      const client = getReportClient();

      expect(client).toBeInstanceOf(StaticReportClient);
    });

    test("returns same cached client on second call", () => {
      (globalThis as unknown as { allureReportOptions?: { apiBaseUrl: string } }).allureReportOptions = {
        apiBaseUrl: "http://localhost:3000",
      };

      const a = getReportClient();
      const b = getReportClient();

      expect(a).toBe(b);
    });

    test("after clearReportClientCache, getReportClient returns new client based on current options", () => {
      (globalThis as unknown as { allureReportOptions?: { apiBaseUrl: string } }).allureReportOptions = {
        apiBaseUrl: "http://localhost:3000",
      };
      const apiClient = getReportClient();
      clearReportClientCache();
      (globalThis as unknown as { allureReportOptions?: unknown }).allureReportOptions = {};
      const staticClient = getReportClient();

      expect(apiClient).toBeInstanceOf(ApiReportClient);
      expect(staticClient).toBeInstanceOf(StaticReportClient);
      expect(staticClient).not.toBe(apiClient);
    });
  });
});
