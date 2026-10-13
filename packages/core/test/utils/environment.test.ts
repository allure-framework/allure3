import type { EnvironmentsConfig } from "@allurereport/core-api";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDynamicEnvironmentResolver,
  resolveDynamicEnvironmentIdentity,
  resolveEnvironmentIdentity,
  resolveStoredEnvironmentIdentity,
} from "../../src/utils/environment.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("environments");
  await story("environment");
  await label("coverage", "environments");
});

describe("environment runtime resolution", () => {
  it("should reject invalid environment ids in public environment resolution", () => {
    expect(
      resolveEnvironmentIdentity(
        {
          environment: "foo/bar",
        },
        {},
        "config",
      ),
    ).toEqual({
      errors: ["config: environment id must contain only latin letters, digits, underscores, and hyphens"],
    });
  });

  it("should ignore path-like runtime keys and fallback to default", () => {
    expect(
      resolveStoredEnvironmentIdentity(
        {
          environment: "foo/bar",
          labels: [],
        },
        {},
      ),
    ).toEqual({
      id: "default",
      name: "default",
    });
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

  it("should resolve id-shaped stored display names through configured names", () => {
    const environmentsConfig: EnvironmentsConfig = {
      qa: {
        name: "QA",
        matcher: () => false,
      },
    };

    expect(
      resolveStoredEnvironmentIdentity(
        {
          environment: "QA",
          labels: [],
        },
        environmentsConfig,
      ),
    ).toEqual({
      id: "qa",
      name: "QA",
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

describe("dynamic environment resolution", () => {
  const labels = [{ name: "host", value: "alpha" }];

  it("should return undefined without a resolver or when the resolver returns nothing", () => {
    expect(resolveDynamicEnvironmentIdentity(undefined, { labels }, {})).toBeUndefined();
    expect(resolveDynamicEnvironmentIdentity(() => undefined, { labels }, {})).toBeUndefined();
    expect(resolveDynamicEnvironmentIdentity(() => null, { labels }, {})).toBeUndefined();
  });

  it("should build an identity from a string id and use the id as name", () => {
    expect(resolveDynamicEnvironmentIdentity(() => "alpha", { labels }, {})).toEqual({ id: "alpha", name: "alpha" });
  });

  it("should use the name returned alongside the id", () => {
    expect(resolveDynamicEnvironmentIdentity(() => ({ id: "alpha", name: "Host alpha" }), { labels }, {})).toEqual({
      id: "alpha",
      name: "Host alpha",
    });
  });

  it("should pass labels to the resolver", () => {
    const resolver = vi.fn(() => "alpha");

    resolveDynamicEnvironmentIdentity(resolver, { labels }, {});

    expect(resolver).toHaveBeenCalledWith({ labels });
  });

  it("should prefer the configured identity when the id is already configured", () => {
    const config: EnvironmentsConfig = { alpha: { name: "Configured alpha", matcher: () => false } };

    expect(resolveDynamicEnvironmentIdentity(() => "alpha", { labels }, config)).toEqual({
      id: "alpha",
      name: "Configured alpha",
    });
  });

  it("should normalize an id with unsupported characters and keep the original as the name", () => {
    expect(resolveDynamicEnvironmentIdentity(() => "srv1.example.com", { labels }, {})).toEqual({
      id: "srv1_example_com",
      name: "srv1.example.com",
      normalizedFrom: "srv1.example.com",
    });
    expect(resolveDynamicEnvironmentIdentity(() => "a/b", { labels }, {})).toEqual({
      id: "a_b",
      name: "a_b",
      normalizedFrom: "a/b",
    });
  });

  it("should fall back to the id as the name when the name of a normalized id is not valid", () => {
    expect(resolveDynamicEnvironmentIdentity(() => ({ id: "a/b", name: "Host a/b" }), { labels }, {})).toEqual({
      id: "a_b",
      name: "a_b",
      normalizedFrom: "a/b",
    });
  });

  it("should resolve a value which can not be normalized to the unresolved environment and report it", () => {
    const onUnusable = vi.fn();

    expect(resolveDynamicEnvironmentIdentity(() => "!!!", { labels }, {}, onUnusable)).toEqual({
      id: "unresolved",
      name: "Unresolved",
    });
    expect(onUnusable).toHaveBeenCalledWith("!!!");
    expect(resolveDynamicEnvironmentIdentity(() => "  ", { labels }, {})?.id).toBe("unresolved");
  });

  it("should throw when the resolver returns something other than a string id or the name is invalid", () => {
    expect(() => resolveDynamicEnvironmentIdentity(() => 42 as unknown as string, { labels }, {})).toThrow(
      /invalid environment id/,
    );
    expect(() => resolveDynamicEnvironmentIdentity(() => ({ id: "alpha", name: "a\nb" }), { labels }, {})).toThrow(
      /invalid environment name/,
    );
  });

  describe("createDynamicEnvironmentResolver", () => {
    const payload = (value?: string) => ({ labels: value === undefined ? [] : [{ name: "host", value }] });

    it("should return functions and undefined as is", () => {
      const fn = () => "x";

      expect(createDynamicEnvironmentResolver(fn)).toBe(fn);
      expect(createDynamicEnvironmentResolver(undefined)).toBeUndefined();
    });

    it("should use the label value as the environment", () => {
      const resolver = createDynamicEnvironmentResolver({ label: "host" })!;

      expect(resolver(payload("alpha"))).toBe("alpha");
      expect(resolver(payload())).toBeUndefined();
      expect(resolver(payload(""))).toBeUndefined();
    });

    it("should extract the environment with a pattern: capture group, whole match or nothing", () => {
      expect(
        createDynamicEnvironmentResolver({ label: "host", pattern: /^[\w-]+/ })!(payload("srv1.example.com")),
      ).toBe("srv1");
      expect(createDynamicEnvironmentResolver({ label: "host", pattern: "^(runner)-" })!(payload("runner-7f3a"))).toBe(
        "runner",
      );
      expect(createDynamicEnvironmentResolver({ label: "host", pattern: /^srv/ })!(payload("db1"))).toEqual({
        id: "unresolved",
        name: "Unresolved",
      });
    });

    it("should not keep state for global patterns", () => {
      const resolver = createDynamicEnvironmentResolver({ label: "host", pattern: /srv\d/g })!;

      expect(resolver(payload("srv1"))).toBe("srv1");
      expect(resolver(payload("srv1"))).toBe("srv1");
    });

    it("should apply the name template", () => {
      const resolver = createDynamicEnvironmentResolver({ label: "host", name: "Host {value}" })!;

      expect(resolver(payload("alpha"))).toEqual({ id: "alpha", name: "Host alpha" });
    });

    it("should reject an empty label or an invalid pattern", () => {
      expect(() => createDynamicEnvironmentResolver({ label: "" })).toThrow(/label must be a non-empty string/);
      expect(() => createDynamicEnvironmentResolver({ label: "host", pattern: "(" })).toThrow(
        /not a valid regular expression/,
      );
    });
  });

  it("should be used by stored resolution only after static matchers and without a forced environment", () => {
    const resolver = () => "dyn";
    const staticConfig: EnvironmentsConfig = { fixed: { matcher: () => true } };

    expect(resolveStoredEnvironmentIdentity({ labels }, {}, { dynamicEnvironments: resolver })).toEqual({
      id: "dyn",
      name: "dyn",
    });
    expect(resolveStoredEnvironmentIdentity({ labels }, staticConfig, { dynamicEnvironments: resolver })?.id).toBe(
      "fixed",
    );
    expect(
      resolveStoredEnvironmentIdentity(
        { labels },
        {},
        { dynamicEnvironments: resolver, forcedEnvironment: { id: "forced", name: "forced" } },
      )?.id,
    ).toBe("forced");
    expect(
      resolveStoredEnvironmentIdentity({ labels }, {}, { dynamicEnvironments: resolver, fallbackToMatch: false }),
    ).toBeUndefined();
  });

  it("should fall back to default when the resolver matches nothing", () => {
    expect(resolveStoredEnvironmentIdentity({ labels: [] }, {}, { dynamicEnvironments: () => undefined })?.id).toBe(
      "default",
    );
  });
});
