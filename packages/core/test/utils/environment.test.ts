import type { EnvironmentsConfig } from "@allurereport/core-api";
import { describe, expect, it } from "vitest";

import { assertValidRuntimeEnvironmentKey, resolveStoredEnvironmentIdentity } from "../../src/utils/environment.js";

describe("environment runtime resolution", () => {
  it("should keep compatibility runtime keys with slashes unchanged", () => {
    expect(assertValidRuntimeEnvironmentKey("foo/bar", "environmentId")).toBe("foo/bar");
  });

  it("should prefer configured display name for a known environment id", () => {
    const environmentsConfig: EnvironmentsConfig = {
      qa: {
        name: "New QA",
        matcher: () => true,
      },
    };

    expect(
      resolveStoredEnvironmentIdentity(
        {
          environment: "qa",
          environmentName: "Old QA",
          labels: [],
        },
        environmentsConfig,
      ),
    ).toEqual({
      id: "qa",
      name: "New QA",
    });
  });

  it("should resolve name-shaped stored environments to compatibility identities", () => {
    expect(
      resolveStoredEnvironmentIdentity(
        {
          environment: "Staging EU",
          labels: [],
        },
        {},
      ),
    ).toEqual({
      id: "Staging EU",
      name: "Staging EU",
    });
  });

  it("should ignore invalid runtime ids and fall back to a valid stored name", () => {
    expect(
      resolveStoredEnvironmentIdentity(
        {
          environment: "foo\rbar",
          environmentName: "Compat Env",
          labels: [],
        },
        {},
      ),
    ).toEqual({
      id: "Compat Env",
      name: "Compat Env",
    });
  });

  it("should return undefined for invalid restored catalog entries when fallback is disabled", () => {
    expect(
      resolveStoredEnvironmentIdentity(
        {
          environment: "foo\rbar",
          environmentName: "bar\rbaz",
          labels: [],
        },
        {},
        { fallbackToMatch: false },
      ),
    ).toBeUndefined();
  });
});
