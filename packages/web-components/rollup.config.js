import * as path from "node:path";
import { fileURLToPath } from "node:url";

import alias from "@rollup/plugin-alias";
import { babel } from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import inject from "@rollup/plugin-inject";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import svgr from "@svgr/rollup";
import autoprefixer from "autoprefixer";
import postcssImport from "postcss-import";
import { defineConfig } from "rollup";
import copy from "rollup-plugin-copy";
import dts from "rollup-plugin-dts";
import postcss from "rollup-plugin-postcss";

import { svgrOptions } from "./svgr.config.js";

const BASE_PATH = path.dirname(fileURLToPath(import.meta.url));
const SRC_PATH = path.resolve(BASE_PATH, "./src");
const DEPENDENCY_PATH = /[/\\](?:\.yarn|node_modules)[/\\]/;

const onLog = (level, log, defaultHandler) => {
  if (log.code === "CIRCULAR_DEPENDENCY") {
    if (log.ids?.length && log.ids.every((id) => DEPENDENCY_PATH.test(id))) {
      return;
    }

    defaultHandler("error", log);
    return;
  }

  defaultHandler(level, log);
};

const entries = {
  index: "src/index.ts",
  core: "src/core.ts",
  Attachment: "src/components/Attachment/Attachment.tsx",
  ChartWidget: "src/components/Charts/ChartWidget.tsx",
  CodeViewer: "src/components/Attachment/CodeViewer.tsx",
  ErrorDiff: "src/components/TestResultError/ErrorDiff.tsx",
  Grid: "src/components/Grid/index.tsx",
  Timeline: "src/components/Timeline/index.ts",
  SuccessRatePieChart: "src/components/Charts/SuccessRatePieChart/index.tsx",
  TreeMapChartWidget: "src/components/Charts/TreeMapChartWidget/index.ts",
  HeatMapWidget: "src/components/Charts/HeatMapWidget/index.ts",
  StabilityDistributionWidget: "src/components/Charts/StabilityDistributionWidget/index.tsx",
  TestBaseGrowthDynamicsChartWidget: "src/components/Charts/TestBaseGrowthDynamicsChartWidget/index.tsx",
  StatusAgePyramidChartWidget: "src/components/Charts/StatusAgePyramidChartWidget/index.tsx",
  TestingPyramidWidget: "src/components/Charts/TestingPyramidWidget/index.tsx",
  CurrentStatusChartWidget: "src/components/Charts/CurrentStatusChartWidget/index.tsx",
  StatusDynamicsChartWidget: "src/components/Charts/StatusDynamicsChartWidget/index.tsx",
  StatusTransitionsChartWidget: "src/components/Charts/StatusTransitionsChartWidget/index.tsx",
  DurationsChartWidget: "src/components/Charts/DurationsChartWidget/index.tsx",
  TrSeveritiesChartWidget: "src/components/Charts/TrSeveritiesChartWidget/index.tsx",
  DurationDynamicsChartWidget: "src/components/Charts/DurationDynamicsChartWidget/index.tsx",
};

export default defineConfig([
  {
    input: entries,
    onLog,
    output: [
      {
        dir: "dist",
        format: "esm",
        sourcemap: true,
      },
    ],
    external: [
      "preact",
      "preact/hooks",
      "preact/compat",
      "@preact/compat",
      "@preact/signals",
      "@preact/signals/utils",
      "mermaid",
      "react",
      "react-dom",
    ],
    plugins: [
      json(),
      alias({
        entries: [
          {
            find: "@",
            replacement: SRC_PATH,
          },
        ],
      }),
      resolve(),
      commonjs(),
      inject({
        Prism: ["prismjs", "default"],
      }),
      typescript({
        tsconfig: "./tsconfig.build.json",
      }),
      babel({
        babelHelpers: "bundled",
        extensions: [".js", ".jsx", ".ts", ".tsx"],
        exclude: ["**/*.test.tsx", "**/*.test.ts"],
      }),
      svgr(svgrOptions),
      postcss({
        modules: true,
        extract: path.resolve(BASE_PATH, "dist/index.css"),
        minimize: true,
        extensions: [".scss", ".css"],
        plugins: [postcssImport(), autoprefixer()],
        use: {
          sass: {
            silenceDeprecations: ["legacy-js-api"],
          },
        },
      }),
      // Webpack consumes these imports after Rollup; retain their semantic chunk names.
      terser({ format: { comments: /webpackChunkName|@preserve|@license|@cc_on|^!/i, preserve_annotations: true } }),
      copy({
        targets: [
          { src: "src/assets/fonts/**/*", dest: "dist/fonts" },
          { src: "src/assets/scss/mixins.scss", dest: "dist/" },
        ],
      }),
    ],
  },
  {
    input: entries,
    output: [
      {
        dir: "dist",
        format: "es",
      },
    ],
    external: ["preact", "preact/hooks", "preact/compat", "react", "react-dom", /\.s?css$/],
    plugins: [
      alias({
        entries: [
          {
            find: "@",
            replacement: SRC_PATH,
          },
        ],
      }),
      dts(),
    ],
  },
]);
