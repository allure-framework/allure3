import type { TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext } from "@allurereport/plugin-api";
import { story } from "allure-js-commons";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { collectStatuses, DEFAULT_STATUSES, getTestKey, mergeStatus } from "../src/helpers.js";
import { XrayPlugin, type XrayPluginOptions } from "../src/plugin.js";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return { ...actual, default: { ...actual.default, create: vi.fn() } };
});

const http = { get: vi.fn(), put: vi.fn(), post: vi.fn() };

const tr = (status: TestResult["status"], ...keys: string[]) =>
  ({ status, links: keys.map((name) => ({ name, type: "tms", url: `https://jira/browse/${name}` })) }) as TestResult;

const store = (results: TestResult[]) =>
  ({ allTestResults: vi.fn().mockResolvedValue(results) }) as unknown as AllureStore;

const context = { reportName: "My Report", reportUrl: "https://reports/1" } as PluginContext;

const options: XrayPluginOptions = { endpoint: "https://jira/", username: "u", password: "p", executions: ["XT-6"] };

beforeEach(async () => {
  await story("index");
  vi.mocked(axios.create).mockReturnValue(http as never);
  http.get.mockResolvedValue({ data: [] });
  http.put.mockResolvedValue({});
  http.post.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("helpers", () => {
  it("takes the Test key from tms link name, falling back to url", () => {
    expect(getTestKey({ type: "tms", name: "XT-1", url: "https://x/y" })).toBe("XT-1");
    expect(getTestKey({ type: "tms", url: "https://jira/browse/XT-2" })).toBe("XT-2");
    expect(getTestKey({ type: "tms", name: "Open in Jira", url: "https://jira/browse/XT-4" })).toBe("XT-4");
    expect(getTestKey({ type: "tms", name: "Open in Jira", url: "https://jira/" })).toBeUndefined();
    expect(getTestKey({ type: "issue", name: "XT-3", url: "https://jira/browse/XT-3" })).toBeUndefined();
  });

  it("merges statuses: FAIL beats PASS, PASS beats TODO", () => {
    expect(mergeStatus("PASS", "FAIL")).toBe("FAIL");
    expect(mergeStatus("FAIL", "PASS")).toBe("FAIL");
    expect(mergeStatus("TODO", "PASS")).toBe("PASS");
    expect(mergeStatus("PASS", "TODO")).toBe("PASS");
    expect(mergeStatus(undefined, "TODO")).toBe("TODO");
  });

  it("collects one merged status per key across results", () => {
    const result = collectStatuses(
      [tr("passed", "XT-1", "XT-2"), tr("broken", "XT-1"), tr("skipped", "XT-3"), tr("passed")],
      DEFAULT_STATUSES,
    );
    expect(Object.fromEntries(result)).toEqual({ "XT-1": "FAIL", "XT-2": "PASS", "XT-3": "TODO" });
  });
});

describe("XrayPlugin", () => {
  it("updates test runs whose status differs and comments on the execution", async () => {
    http.get.mockResolvedValueOnce({
      data: [
        { id: 10, key: "XT-1", status: "TODO" },
        { id: 11, key: "XT-2", status: "PASS" },
        { id: 12, key: "XT-9", status: "TODO" },
      ],
    });

    await new XrayPlugin(options).done(context, store([tr("failed", "XT-1"), tr("passed", "XT-2")]));

    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: "https://jira/rest/", auth: { username: "u", password: "p" } }),
    );
    expect(http.get).toHaveBeenCalledWith("raven/1.0/api/testexec/XT-6/test", { params: { page: 1 } });
    expect(http.put).toHaveBeenCalledTimes(1);
    expect(http.put).toHaveBeenCalledWith("raven/1.0/api/testrun/10/status", undefined, { params: { status: "FAIL" } });
    expect(http.post).toHaveBeenCalledWith("api/2/issue/XT-6/comment", {
      body: "Execution updated from report [My Report|https://reports/1]",
    });
  });

  it("reads further pages while a full page is returned", async () => {
    const fullPage = Array.from({ length: 1000 }, (_, i) => ({ id: i, key: `XT-${i}`, status: "TODO" }));
    http.get.mockResolvedValueOnce({ data: fullPage }).mockResolvedValueOnce({ data: [] });

    await new XrayPlugin(options).done(context, store([tr("passed", "XT-5")]));

    expect(http.get).toHaveBeenCalledTimes(2);
    expect(http.get).toHaveBeenLastCalledWith("raven/1.0/api/testexec/XT-6/test", { params: { page: 2 } });
    expect(http.put).toHaveBeenCalledWith("raven/1.0/api/testrun/5/status", undefined, { params: { status: "PASS" } });
  });

  it("uses a bearer token and honours status overrides and env configuration", async () => {
    vi.stubEnv("ALLURE_XRAY_ENDPOINT", "https://jira");
    vi.stubEnv("ALLURE_XRAY_TOKEN", "pat");
    vi.stubEnv("ALLURE_XRAY_EXECUTIONS", "XT-6, XT-7");
    vi.stubEnv("ALLURE_XRAY_STATUS_SKIPPED", "FAIL");
    http.get.mockResolvedValue({ data: [{ id: 1, key: "XT-1", status: "TODO" }] });

    await new XrayPlugin().done(context, store([tr("skipped", "XT-1")]));

    expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({ headers: { Authorization: "Bearer pat" } }));
    expect(http.get).toHaveBeenCalledTimes(2);
    expect(http.put).toHaveBeenCalledWith("raven/1.0/api/testrun/1/status", undefined, { params: { status: "FAIL" } });
    expect(http.post).toHaveBeenCalledTimes(2);
  });

  it("does not comment when disabled or when the report url is unknown", async () => {
    const results = store([tr("passed", "XT-1")]);

    await new XrayPlugin({ ...options, comment: false }).done(context, results);
    await new XrayPlugin(options).done({ ...context, reportUrl: undefined }, results);

    expect(http.get).toHaveBeenCalledTimes(2);
    expect(http.post).not.toHaveBeenCalled();
  });

  it("does not call Jira when no test is linked to Xray", async () => {
    await new XrayPlugin(options).done(context, store([tr("passed")]));

    expect(http.get).not.toHaveBeenCalled();
    expect(http.post).not.toHaveBeenCalled();
  });

  it("queries and comments each Test Execution once and escapes the report name", async () => {
    await new XrayPlugin({ ...options, executions: ["XT-6", " XT-6 ", "XT-7"] }).done(
      { ...context, reportName: "Report [nightly | main] \\" },
      store([tr("passed", "XT-1")]),
    );

    expect(http.get).toHaveBeenCalledTimes(2);
    expect(http.post).toHaveBeenCalledTimes(2);
    expect(http.post).toHaveBeenCalledWith("api/2/issue/XT-7/comment", {
      body: "Execution updated from report [Report \\[nightly \\| main\\] \\\\|https://reports/1]",
    });
  });

  it("keeps going and reports to stderr when Xray requests fail", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    http.get.mockResolvedValueOnce({ data: [{ id: 1, key: "XT-1", status: "TODO" }] });
    http.put.mockRejectedValueOnce(new Error("boom"));
    http.post.mockRejectedValueOnce(new Error("nope"));

    await expect(new XrayPlugin(options).done(context, store([tr("passed", "XT-1")]))).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith(expect.stringContaining("failed to update test run XT-1"));
    expect(error).toHaveBeenCalledWith(expect.stringContaining("failed to comment on XT-6"));
  });

  it.each([
    ["endpoint", { ...options, endpoint: undefined }, "endpoint is not set"],
    ["credentials", { ...options, password: undefined }, "either token or both username and password"],
    ["executions", { ...options, executions: [] }, "no Test Executions specified"],
    ["status", { ...options, statuses: { passed: "OK" as never } }, 'unsupported Xray status "OK"'],
  ])("fails fast on invalid %s", async (_, opts, message) => {
    await expect(new XrayPlugin(opts).done(context, store([]))).rejects.toThrow(message);
    expect(http.get).not.toHaveBeenCalled();
  });
});
