import { describe, expect, it } from "vite-plus/test";

import type { TestResult } from "../../src/model.js";
import { createTestPlan } from "../../src/utils/testplan.js";

const result = (overrides: Partial<TestResult> = {}): TestResult => ({ labels: [], ...overrides }) as TestResult;

const serialize = (value: unknown) => JSON.parse(JSON.stringify(value));

describe("createTestPlan", () => {
  it("includes an empty muted list when omitted", () => {
    const testResults = [result({ fullName: "suite#regular" })];

    const plan = createTestPlan(testResults);

    expect(serialize(plan)).toEqual({
      version: "1.0",
      tests: [{ selector: "suite#regular" }],
      mutedTests: [],
    });
  });

  it("returns both empty arrays", () => {
    const plan = createTestPlan([], []);

    expect(plan).toEqual({ version: "1.0", tests: [], mutedTests: [] });
  });

  it("maps muted result identifiers", () => {
    const mutedResults = [
      result({
        runSelector: "runner#selected",
        fullName: "display#name",
        labels: [{ name: "ALLURE_ID", value: "42" }],
      }),
      result({ labels: [{ name: "ALLURE_ID", value: "43" }] }),
      result({ fullName: "suite#fallback" }),
      result(),
    ];

    const plan = createTestPlan([], mutedResults);

    expect(serialize(plan)).toEqual({
      version: "1.0",
      tests: [],
      mutedTests: [{ selector: "runner#selected", id: "42" }, { id: "43" }, { selector: "suite#fallback" }],
    });
  });

  it("deduplicates selectors independently per list", () => {
    const shared = result({ fullName: "suite#shared" });

    const plan = createTestPlan([shared, shared], [shared, shared]);

    expect(serialize(plan)).toEqual({
      version: "1.0",
      tests: [{ selector: "suite#shared" }],
      mutedTests: [{ selector: "suite#shared" }],
    });
  });
});
