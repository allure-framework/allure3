import { describe, expect, it } from "vitest";

import {
  environmentNameById,
  migrateStoredEnvironmentSelection,
  normalizeEnvironmentsWidget,
} from "../src/environments.js";

const environments = [
  { id: "default", name: "default" },
  { id: "qa", name: "QA" },
];

describe("environment helpers", () => {
  it("should resolve names from environment identities", () => {
    expect(environmentNameById(environments, "qa")).toBe("QA");
    expect(environmentNameById(environments, "unknown")).toBe("unknown");
  });

  it("should keep persisted ids unchanged", () => {
    expect(migrateStoredEnvironmentSelection("qa", environments)).toBe("qa");
  });

  it("should migrate persisted names to ids when they match exactly", () => {
    expect(migrateStoredEnvironmentSelection("QA", environments)).toBe("qa");
  });

  it("should reset invalid or missing persisted values", () => {
    expect(migrateStoredEnvironmentSelection("", environments)).toBe("");
    expect(migrateStoredEnvironmentSelection("missing", environments)).toBe("");
  });

  it("normalizeEnvironmentsWidget should map legacy string[] to identities", () => {
    expect(normalizeEnvironmentsWidget(["default", "staging"])).toEqual([
      { id: "default", name: "default" },
      { id: "staging", name: "staging" },
    ]);
  });

  it("normalizeEnvironmentsWidget should accept EnvironmentIdentity objects", () => {
    expect(
      normalizeEnvironmentsWidget([
        { id: "default", name: "default" },
        { id: "qa", name: "QA" },
      ]),
    ).toEqual([
      { id: "default", name: "default" },
      { id: "qa", name: "QA" },
    ]);
  });

  it("normalizeEnvironmentsWidget should skip invalid ids and non-arrays", () => {
    expect(normalizeEnvironmentsWidget(null)).toEqual([]);
    expect(normalizeEnvironmentsWidget([{ id: "bad id!", name: "x" }])).toEqual([]);
    expect(normalizeEnvironmentsWidget([42, "ok"])).toEqual([{ id: "ok", name: "ok" }]);
  });
});
