import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { getPackageRoot, readTemplateManifest } from "../src/generators.js";

const packageDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

describe("plugin-allure2 package layout (#601)", () => {
  it("publishes static/ so npm pack includes template assets required at runtime", async () => {
    const packageJson = JSON.parse(await readFile(join(packageDir, "package.json"), "utf-8")) as {
      files?: string[];
    };

    expect(packageJson.files, "package.json files must list static assets for publish").toEqual(
      expect.arrayContaining(["./static"]),
    );
    expect(packageJson.files).toEqual(expect.arrayContaining(["./dist"]));

    // Mimic npm pack inclusion: every path generators read under static/ must exist
    // on disk next to package.json (what getPackageRoot resolves after install).
    for (const mode of ["single", "multi"] as const) {
      const manifestPath = join(packageDir, "static", mode, "manifest.json");
      const raw = await readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(raw) as Record<string, string>;

      expect(Object.keys(manifest).length).toBeGreaterThan(0);

      for (const fileName of Object.values(manifest)) {
        await expect(readFile(join(packageDir, "static", mode, fileName))).resolves.toBeInstanceOf(Buffer);
      }
    }
  });

  it("resolves static manifests from package root for single and multi modes", async () => {
    const packageRoot = await getPackageRoot();

    expect(packageRoot).toBe(packageDir);

    const singleManifest = await readTemplateManifest(packageRoot, true);
    const multiManifest = await readTemplateManifest(packageRoot, false);

    expect(singleManifest["main.js"]).toBeTruthy();
    expect(multiManifest["main.js"]).toBeTruthy();
  });
});
