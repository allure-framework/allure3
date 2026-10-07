import type { CiDescriptor, TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext } from "@allurereport/plugin-api";
import { describe, expect, it, vi } from "vitest";

import { collectMailData } from "../src/data.js";
import MailPlugin from "../src/index.js";
import { renderMail } from "../src/render.js";

const tr = (overrides: Partial<TestResult>): TestResult =>
  ({
    id: "id",
    name: "test",
    status: "passed",
    flaky: false,
    muted: false,
    known: false,
    hidden: false,
    labels: [],
    parameters: [],
    links: [],
    steps: [],
    sourceMetadata: { readerId: "", metadata: {} },
    ...overrides,
  }) as TestResult;

const createStore = (results: TestResult[]) => {
  const count = (status: string) => results.filter((r) => r.status === status).length;

  return {
    allTestResults: async () => results,
    failedTestResults: async () => results.filter((r) => r.status === "failed" || r.status === "broken"),
    testsStatistic: async () => ({
      total: results.length,
      passed: count("passed"),
      failed: count("failed"),
      broken: count("broken"),
      skipped: count("skipped"),
      unknown: count("unknown"),
    }),
  } as unknown as AllureStore;
};

const createContext = (overrides: Partial<PluginContext> = {}) => {
  const addFile = vi.fn(async (path: string) => path);

  return {
    context: { reportName: "My Report", reportFiles: { addFile }, ...overrides } as unknown as PluginContext,
    addFile,
  };
};

const results = [
  tr({ id: "1", name: "ok", status: "passed", start: 1000, stop: 2000, duration: 1000 }),
  tr({
    id: "2",
    name: "b-broken",
    fullName: "b.broken",
    status: "broken",
    error: { message: "boom" },
    start: 2000,
    stop: 5000,
  }),
  tr({
    id: "3",
    name: "a-failed",
    fullName: "a.<b>failed</b>",
    status: "failed",
    error: { message: "x < y" },
    start: 3000,
    stop: 4000,
  }),
];

describe("collectMailData", () => {
  it("collects stats, pass rate, duration and the worst status", async () => {
    const { context } = createContext();
    const data = await collectMailData(context, createStore(results));

    expect(data).toMatchObject({ title: "My Report", status: "failed", passRate: 33, duration: "4s" });
    expect(data.stats.total).toBe(3);
  });

  it("lists failed before broken tests and respects maxFailed", async () => {
    const { context } = createContext();
    const data = await collectMailData(context, createStore(results), { maxFailed: 1 });

    expect(data.failed.map(({ status }) => status)).toEqual(["failed"]);
    expect(data.hiddenFailed).toBe(1);
  });

  it("prefers options over context for title and report url", async () => {
    const { context } = createContext({ reportUrl: "https://ctx.example" });
    const fromContext = await collectMailData(context, createStore([]));
    const fromOptions = await collectMailData(context, createStore([]), {
      title: "Custom",
      reportUrl: "https://opt.example",
    });

    expect(fromContext.reportUrl).toBe("https://ctx.example");
    expect(fromOptions).toMatchObject({ title: "Custom", reportUrl: "https://opt.example" });
  });

  it("never rounds the pass rate up to 100% while some tests did not pass", async () => {
    const many = [...Array.from({ length: 999 }, (_, i) => tr({ id: `p${i}` })), tr({ id: "f", status: "failed" })];
    const data = await collectMailData(createContext().context, createStore(many));

    expect(data.passRate).toBe(99);
  });

  it("falls back to the default limit for an invalid maxFailed and hides all failed tests for 0", async () => {
    const { context } = createContext();
    const invalid = await collectMailData(context, createStore(results), { maxFailed: Number.NaN });
    const zero = await collectMailData(context, createStore(results), { maxFailed: 0 });

    expect(invalid.failed).toHaveLength(2);
    expect(zero).toMatchObject({ failed: [], hiddenFailed: 2 });
  });

  it("falls back to the report name for an empty title and does not mutate the store results", async () => {
    const failedResults = [results[1], results[2]];
    const store = { ...createStore(results), failedTestResults: async () => failedResults } as unknown as AllureStore;
    const data = await collectMailData(createContext().context, store, { title: "" });

    expect(data.title).toBe("My Report");
    expect(failedResults.map(({ id }) => id)).toEqual(["2", "3"]);
  });

  it("collapses multi-line error messages", async () => {
    const multiline = [tr({ id: "m", status: "failed", error: { message: "line one\n  line two" } })];
    const data = await collectMailData(createContext().context, createStore(multiline));

    expect(data.failed[0].message).toBe("line one line two");
  });

  it("includes CI info only when CI was detected", async () => {
    const ci = {
      detected: true,
      jobRunName: "build #1",
      jobRunUrl: "https://ci/1",
      jobRunBranch: "main",
    } as CiDescriptor;
    const detected = await collectMailData(createContext({ ci }).context, createStore([]));
    const notDetected = await collectMailData(
      createContext({ ci: { ...ci, detected: false } }).context,
      createStore([]),
    );

    expect(detected.ci).toMatchObject({ name: "build #1", url: "https://ci/1", branch: "main" });
    expect(notDetected.ci).toBeUndefined();
  });

  it("handles an empty run", async () => {
    const data = await collectMailData(createContext().context, createStore([]));

    expect(data).toMatchObject({ status: "passed", passRate: 0, failed: [], hiddenFailed: 0 });
  });
});

describe("renderMail", () => {
  it("renders cross-client html with summary and escapes test text", async () => {
    const data = await collectMailData(createContext().context, createStore(results), {
      reportUrl: "https://reports.example/1",
    });
    const html = await renderMail(data);

    expect(html).toContain("My Report");
    expect(html).toContain("33% passed");
    expect(html).toContain('href="https://reports.example/1"');
    expect(html).toContain("a.&lt;b&gt;failed&lt;/b&gt;");
    expect(html).toContain("x &lt; y");
    expect(html).toContain("Failed");
    expect(html).not.toContain("<b>failed</b>");
  });

  it("drops non-http report links", async () => {
    const data = await collectMailData(createContext().context, createStore([]), { reportUrl: "javascript:alert(1)" });

    expect(await renderMail(data)).not.toContain("javascript:");
  });
});

describe("MailPlugin", () => {
  it("writes mail.html to the report files", async () => {
    const { context, addFile } = createContext();

    await new MailPlugin().done(context, createStore(results));

    expect(addFile).toHaveBeenCalledOnce();
    expect(addFile.mock.calls[0][0]).toBe("mail.html");
    expect(addFile.mock.calls[0][1].toString()).toContain("<html");
  });

  it("supports a custom filename and does not fail without results", async () => {
    const { context, addFile } = createContext();

    await new MailPlugin({ filename: "summary.html" }).done(context, createStore([]));

    expect(addFile.mock.calls[0][0]).toBe("summary.html");
  });
});
