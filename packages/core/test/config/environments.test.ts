import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Config } from "@allurereport/plugin-api";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { readConfig, resolveConfig } from "../../src/config.js";
import { resolveStoredEnvironmentIdentity } from "../../src/utils/environment.js";

const firefox = "${{ labels.exists(l, l.name == 'browser' && l.value == 'firefox') }}";

const resolve = (environments: Config["environments"]) => resolveConfig({ environments }, { plugins: {} });

const fixtures: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(fixtures.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("environment configuration expressions", () => {
  it("loads folded YAML environment predicates with allowed environment IDs", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "allure-cel-environments-"));
    fixtures.push(cwd);
    await writeFile(
      join(cwd, "allurerc.yml"),
      `
allowedEnvironments:
  - firefox
environments:
  firefox:
    name: Firefox
    matcher: >-
      \${{ labels.exists(l, l.name == 'browser' &&
          l.value == 'firefox') }}
`,
    );

    const config = await readConfig(cwd, undefined, { plugins: {} });
    const matched = resolveStoredEnvironmentIdentity(
      { labels: [{ name: "browser", value: "firefox" }] },
      config.environments!,
    );

    expect(config.allowedEnvironments).toEqual(["firefox"]);
    expect(Object.keys(config.environments!)).toEqual(["firefox"]);
    expect(matched).toEqual({ id: "firefox", name: "Firefox" });
  });

  it("validates allowed environment IDs for expression-based descriptors", async () => {
    const input: Config = { allowedEnvironments: ["firefox"], environments: { unlisted: { matcher: firefox } } };

    const resolution = resolveConfig(input, { plugins: {} });

    await expect(resolution).rejects.toThrow('environment id "unlisted" is not listed in allowedEnvironments');
  });

  it.each([
    {
      labels: [
        { name: "browser", value: "firefox" },
        { name: "browser", value: "chrome" },
      ],
      want: { id: "firefox", name: "Firefox" },
    },
    {
      labels: [
        { name: "browser", value: "linux" },
        { name: "os", value: "firefox" },
      ],
      want: { id: "default", name: "default" },
    },
    { labels: [], want: { id: "default", name: "default" } },
  ])("matches correlated label pairs without discarding duplicates: $labels", async ({ labels, want }) => {
    const config = await resolve({ firefox: { name: "Firefox", matcher: firefox } });

    const matched = resolveStoredEnvironmentIdentity({ labels }, config.environments!);

    expect(matched).toEqual(want);
  });

  it("matches missing label values as empty strings without warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const config = await resolve({
      empty: { matcher: "${{ labels.exists(l, l.name == 'browser' && l.value == '') }}" },
    });

    const matched = resolveStoredEnvironmentIdentity({ labels: [{ name: "browser" }] }, config.environments!);

    expect(matched).toEqual({ id: "empty", name: "empty" });
    expect(warn).not.toHaveBeenCalled();
  });

  it("preserves callback matchers, ordering, variables and input data", async () => {
    const callback = () => true;
    const input = {
      firefox: { name: "Firefox", variables: { browser: "Firefox" }, matcher: firefox },
      fallback: { matcher: callback },
    };
    const config = await resolve(input);

    const matched = resolveStoredEnvironmentIdentity(
      { labels: [{ name: "browser", value: "firefox" }] },
      config.environments!,
    );

    expect(matched).toEqual({ id: "firefox", name: "Firefox" });
    expect(config.environments?.firefox.variables).toEqual({ browser: "Firefox" });
    expect(config.environments?.fallback.matcher).toBe(callback);
    expect(input.firefox.matcher).toBe(firefox);
  });

  it("rejects invalid environment expressions during configuration loading", async () => {
    const resolution = resolve({ malformed: { matcher: "${{ labels. }}" } });

    await expect(resolution).rejects.toThrow('Invalid expression at environments["malformed"].matcher:');
  });

  it("propagates environment evaluation errors with the configuration path", async () => {
    const config = await resolve({ runtime: { matcher: "${{ labels[0].value.matches('[') }}" } });

    const match = () =>
      resolveStoredEnvironmentIdentity({ labels: [{ name: "browser", value: "firefox" }] }, config.environments!);

    expect(match).toThrow('Invalid expression at environments["runtime"].matcher:');
  });

  it("supplies only name/value label pairs to expressions", async () => {
    const config = await resolve({
      firefox: { matcher: "${{ labels.exists(l, l.name == 'browser' && l.value == 'firefox' && !has(l.secret)) }}" },
    });
    const labels = [{ name: "browser", value: "firefox", secret: "not exposed" }];

    const matched = resolveStoredEnvironmentIdentity({ labels }, config.environments!);

    expect(matched).toEqual({ id: "firefox", name: "firefox" });
  });

  it("retains empty environment configuration", async () => {
    const config = await resolve(undefined);

    const matched = resolveStoredEnvironmentIdentity({}, config.environments!);

    expect(config.environments).toEqual({});
    expect(matched).toEqual({ id: "default", name: "default" });
  });
});
