import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { feature, story } from "allure-js-commons";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());

// This package integration check requires `yarn workspace @allurereport/web-components build` first.
// Allow for cold imports under CI contention; keep unit-test timeouts unchanged.
it("ships subpaths with declarations and preserves the root export identities", { timeout: 30_000 }, async () => {
  await feature("web-components-package");
  await story("public-entrypoints");
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
  await expect(access(resolve("dist/index.css"))).resolves.toBeUndefined();
  const pkg = JSON.parse(await readFile(resolve("package.json"), "utf8"));
  const [{ input: buildEntries }] = (await import(pathToFileURL(resolve("rollup.config.js")).href)).default;
  const exportedEntries = Object.fromEntries(
    Object.entries(pkg.exports)
      .filter(([, target]) => typeof target === "object" && target !== null && "types" in target)
      .map(([subpath, target]) => {
        const { types, import: script } = target as { types: string; import: string };
        return [subpath, { types, import: script }];
      }),
  );
  expect(exportedEntries).toEqual(
    Object.fromEntries(
      Object.keys(buildEntries).map((name) => [
        name === "index" ? "." : `./${name}`,
        { types: `./dist/${name}.d.ts`, import: `./dist/${name}.js` },
      ]),
    ),
  );
  expect(pkg.typesVersions).toEqual({
    "*": Object.fromEntries(
      Object.keys(buildEntries)
        .filter((name) => name !== "index")
        .map((name) => [name, [`dist/${name}.d.ts`]]),
    ),
  });
  const entries = new Map<string, Record<string, unknown>>();
  for (const [subpath, target] of Object.entries(pkg.exports)) {
    if (subpath === "." || subpath.includes("*") || typeof target !== "object") continue;
    const { types, import: script } = target as { types: string; import: string };
    await expect(access(resolve(types))).resolves.toBeUndefined();
    const entry = await import(pathToFileURL(resolve(script)).href);
    expect(Object.keys(entry).length).toBeGreaterThan(0);
    entries.set(subpath, entry);
  }
  // Load subpaths first so root initialization cannot hide a missing dependency.
  const root: Record<string, unknown> = await import(pathToFileURL(resolve("dist/index.js")).href);
  const core = entries.get("./core")!;
  expect(core.Button).toBe(root.Button);
  expect(core).not.toHaveProperty("CurrentStatusChartWidget");
  expect(core).not.toHaveProperty("CodeViewer");
  expect(core).not.toHaveProperty("Attachment");
  for (const [subpath, entry] of entries) {
    for (const [name, value] of Object.entries(entry)) {
      expect(Object.hasOwn(root, name), `${subpath} exports ${name} through the original root too`).toBe(true);
      expect(value, `${subpath}/${name} has one shared implementation`).toBe(root[name]);
    }
  }
});
