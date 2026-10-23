import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { feature, story } from "allure-js-commons";
import { expect, it } from "vite-plus/test";

import { ReportFeatureAssetsPlugin } from "../../../scripts/report-feature-assets.mjs";

const require = createRequire(import.meta.url);
const webpack: typeof import("webpack") = require("webpack");
const { WebpackManifestPlugin } = require("webpack-manifest-plugin");

it.each(["valid", "missing-related", "no-features"])(
  "maps the dependency graph and rejects broken compilation contracts (%s)",
  { timeout: 30_000 },
  async (scenario) => {
    await feature("report-feature-assets");
    await story("webpack-graph");
    const root = await mkdtemp(join(tmpdir(), "allure-feature-build-"));
    try {
      const sources = {
        "index.js": `export const pie = () => import(/* webpackChunkName: "chart-pie" */ "./pie.js");
        export const bar = () => import(/* webpackChunkName: "chart-bar" */ "./bar.js");
        export const utility = () => import(/* webpackChunkName: "utility" */ "./utility.js");`,
        "pie.js": `import { shared } from "./shared.js"; export const value = shared;
        export const image = new URL("./pixel.png", import.meta.url);
        export const nested = () => import(/* webpackChunkName: "nested" */ "./nested.js");`,
        "bar.js": 'export { shared } from "./shared.js";',
        "shared.js": 'export const shared = "shared dependency";',
        "nested.js": 'export const nested = "nested viewer";',
        "utility.js": 'export const utility = "base async utility";',
        "pixel.png": "pixel",
      };
      if (scenario === "no-features") sources["index.js"] = 'export const utility = () => import("./utility.js");';
      for (const [name, content] of Object.entries(sources)) await writeFile(join(root, name), content);
      const compiler = webpack({
        context: root,
        entry: "./index.js",
        mode: "production",
        output: {
          path: join(root, "dist"),
          filename: "app-[contenthash].js",
          chunkFilename: "[name]-[contenthash].js",
          library: { type: "commonjs2" },
        },
        module: { rules: [{ test: /\.png$/, type: "asset/resource" }] },
        optimization: {
          minimize: false,
          splitChunks: {
            cacheGroups: {
              shared: { test: /shared\.js$/, name: "shared", chunks: "async", minSize: 0, enforce: true },
            },
          },
        },
        plugins: [
          {
            apply(compiler) {
              compiler.hooks.thisCompilation.tap("FixtureAssets", (compilation) => {
                compilation.hooks.processAssets.tap(
                  { name: "FixtureAssets", stage: webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE },
                  () => {
                    compilation.emitAsset("favicon.txt", new webpack.sources.RawSource("always retained"));
                    compilation.emitAsset("pie.LICENSE.txt", new webpack.sources.RawSource("license"), {
                      related: {
                        license: scenario === "missing-related" ? "missing.LICENSE.txt" : "shared.LICENSE.txt",
                      },
                    });
                    compilation.emitAsset("shared.LICENSE.txt", new webpack.sources.RawSource("shared license"), {
                      related: { license: "pie.LICENSE.txt" },
                    });
                    const group = compilation.namedChunkGroups.get("chart-pie");
                    if (!group) return;
                    const file = group.getFiles().find((name) => name.startsWith("chart-pie"));
                    if (!file) throw new Error("Chart pie fixture asset not found");
                    compilation.updateAsset(file, (source) => source, {
                      related: { license: "pie.LICENSE.txt" },
                    });
                  },
                );
              });
            },
          },
          new ReportFeatureAssetsPlugin(),
          new WebpackManifestPlugin({ publicPath: "" }),
        ],
      });
      const build = new Promise<void>((resolve, reject) =>
        compiler.run((error, stats) => {
          compiler.close((closeError) => {
            if (error || closeError || stats?.hasErrors())
              reject(error ?? closeError ?? new Error(stats!.toString({ all: false, errors: true })));
            else resolve();
          });
        }),
      );
      if (scenario === "no-features") {
        await expect(build).rejects.toThrow("No report feature chunk groups found");
        return;
      }
      if (scenario === "missing-related") {
        await expect(build).rejects.toThrow("Missing report feature asset: missing.LICENSE.txt");
        return;
      }
      await build;
      const output = join(root, "dist");
      const graph = JSON.parse(await readFile(join(output, "feature-assets.json"), "utf8"));
      const manifest = JSON.parse(await readFile(join(output, "manifest.json"), "utf8"));
      expect(graph.version).toBe(1);
      expect(graph.initial).toEqual([manifest["main.js"]]);
      expect(graph.base).toContain("favicon.txt");
      expect(graph.base.some((file: string) => file.startsWith("utility-"))).toBe(true);
      const pie: string[] = graph.features["chart-pie"];
      const bar: string[] = graph.features["chart-bar"];
      const shared = pie.find((file) => file.startsWith("shared-"));
      expect(shared).toBeDefined();
      expect(bar).toContain(shared);
      expect(pie.some((file) => file.startsWith("nested-"))).toBe(true);
      expect(pie.some((file) => file.endsWith(".png"))).toBe(true);
      expect(pie).toContain("pie.LICENSE.txt");
      expect(pie).toContain("shared.LICENSE.txt");
      expect(new Set(pie).size).toBe(pie.length);
      expect(graph.base).not.toContain("pie.LICENSE.txt");
      expect(graph.base).not.toContain("shared.LICENSE.txt");
      expect(Object.keys(graph.features)).toEqual(["chart-bar", "chart-pie"]);
      const classified = new Set([...graph.base, ...Object.values(graph.features).flat()]);
      expect([...classified].sort()).toEqual(
        (await readdir(output)).filter((file) => !["manifest.json", "feature-assets.json"].includes(file)).sort(),
      );
      for (const files of Object.values(graph.features) as string[][])
        for (const file of files) {
          // The flat manifest may omit related licenses; the feature graph owns that relationship.
          if (!file.endsWith(".LICENSE.txt")) {
            expect(Object.values(manifest)).toContain(file);
          }
        }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);

it.each(["awesome", "dashboard"])("preserves production feature boundaries for %s", async (report) => {
  await feature("report-feature-assets");
  await story("production-boundaries");
  const graph = JSON.parse(
    await readFile(
      join(dirname(fileURLToPath(import.meta.url)), "../..", `web-${report}`, "dist/multi/feature-assets.json"),
      "utf8",
    ),
  );
  const expected = [
    "attachment-code",
    "attachment-html",
    "attachment-http",
    "attachment-image-diff",
    "attachment-markdown",
    "attachment-mermaid",
    "attachment-table",
    "chart-bar",
    "chart-funnel",
    "chart-heatmap",
    "chart-pie",
    "chart-treemap",
    ...(report === "awesome" ? ["error-diff"] : []),
  ];
  expect(Object.keys(graph.features)).toEqual(expected);
  for (const files of Object.values(graph.features) as string[][]) expect(files.length).toBeGreaterThan(0);
});
