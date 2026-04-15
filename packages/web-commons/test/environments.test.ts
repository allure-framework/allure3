import { describe, expect, it } from "vitest";

import { environmentNameById, migrateStoredEnvironmentSelection } from "../src/environments.js";

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
});
