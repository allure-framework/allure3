import type { TestResult } from "@allurereport/core-api";
import type { AllureStore, PluginContext } from "@allurereport/plugin-api";
import { describe, expect, it, vi } from "vite-plus/test";

import { TestPlanPlugin } from "../src/plugin.js";

const result = (overrides: Partial<TestResult> = {}): TestResult =>
  ({ labels: [], status: "passed", muted: false, ...overrides }) as TestResult;

const generate = async (results: TestResult[], options: ConstructorParameters<typeof TestPlanPlugin>[0] = {}) => {
  const files: { name: string; plan: unknown }[] = [];
  const context = {
    reportFiles: {
      addFile: async (name: string, content: Buffer) => {
        files.push({ name, plan: JSON.parse(content.toString("utf-8")) });
      },
    },
  } as unknown as PluginContext;
  const store = { allTestResults: vi.fn().mockResolvedValue(results) } as unknown as AllureStore;

  await new TestPlanPlugin(options).done(context, store);

  return files;
};

describe("TestPlanPlugin", () => {
  it("writes only muted tests without applying the selection filter", async () => {
    const results = [
      result({ fullName: "regularFailure", status: "failed" }),
      result({ fullName: "mutedPassed", muted: true }),
      result({ fullName: "resolvedMuted", resolution: "muted" }),
    ];

    const files = await generate(results, {
      mutedOnly: true,
      fileName: "muted.json",
      filter: () => {
        throw new Error("selection filter must not run in muted-only mode");
      },
    });

    expect(files).toEqual([
      { name: "muted.json", plan: { version: "1.0", mutedTests: [{ selector: "mutedPassed" }] } },
    ]);
  });

  it.each([
    { name: "no results", results: [] },
    { name: "no muted results", results: [result({ fullName: "regularFailure", status: "failed" })] },
  ])("writes an empty muted-only plan with $name", async ({ results }) => {
    const files = await generate(results, { mutedOnly: true });

    expect(files).toEqual([{ name: "testplan.json", plan: { version: "1.0", mutedTests: [] } }]);
  });

  it("collects muted results independently of default selection", async () => {
    const results = [
      result({ fullName: "regularFailure", status: "failed" }),
      result({ fullName: "mutedFailure", status: "failed", muted: true }),
      result({ fullName: "mutedPassed", muted: true }),
    ];

    const files = await generate(results);

    expect(files).toEqual([
      {
        name: "testplan.json",
        plan: {
          version: "1.0",
          tests: [{ selector: "regularFailure" }, { selector: "mutedFailure" }],
          mutedTests: [{ selector: "mutedFailure" }, { selector: "mutedPassed" }],
        },
      },
    ]);
  });

  it("writes a muted-only plan with a custom filter", async () => {
    const results = [
      result({ fullName: "mutedPassed", muted: true }),
      result({ fullName: "resolvedMuted", resolution: "muted" }),
    ];

    const files = await generate(results, { filter: () => false, fileName: "rerun.json" });

    expect(files).toEqual([
      {
        name: "rerun.json",
        plan: { version: "1.0", tests: [], mutedTests: [{ selector: "mutedPassed" }] },
      },
    ]);
  });

  it("includes an empty muted array for a non-muted failure", async () => {
    const results = [result({ fullName: "regularFailure", status: "failed" })];

    const files = await generate(results);

    expect(files).toEqual([
      {
        name: "testplan.json",
        plan: { version: "1.0", tests: [{ selector: "regularFailure" }], mutedTests: [] },
      },
    ]);
  });

  it("skips generation when both candidate collections are empty", async () => {
    const results = [result({ fullName: "regularPassed" })];

    const files = await generate(results);

    expect(files).toEqual([]);
  });

  it("preserves generation for candidates without identifiers", async () => {
    const results = [result({ status: "failed" })];

    const files = await generate(results);

    expect(files).toEqual([
      {
        name: "testplan.json",
        plan: { version: "1.0", tests: [], mutedTests: [] },
      },
    ]);
  });
});
