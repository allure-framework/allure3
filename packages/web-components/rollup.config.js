import alias from "@rollup/plugin-alias";
import { babel } from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import autoprefixer from "autoprefixer";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import postcssImport from "postcss-import";
import { defineConfig } from "rollup";
import copy from "rollup-plugin-copy";
import dts from "rollup-plugin-dts";
import postcss from "rollup-plugin-postcss";
import svg from "rollup-plugin-svg-sprites";

const BASE_PATH = path.dirname(fileURLToPath(import.meta.url));
const SRC_PATH = path.resolve(BASE_PATH, "./src");

export default defineConfig([
  {
    input: "src/index.ts",
    output: [
      {
        dir: "dist",
        format: "esm",
        sourcemap: true,
      },
    ],
    external: ["preact", "preact/hooks", "react", "react-dom"],
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
      typescript({
        tsconfig: "./tsconfig.json",
      }),
      babel({
        babelHelpers: "bundled",
        extensions: [".js", ".jsx", ".ts", ".tsx"],
        exclude: ["**", "**/*.test.tsx", "**/*.test.ts"],
        jsx: true,
      }),
      svg(),
      postcss({
        modules: true,
        extract: true,
        minimize: true,
        extensions: [".scss", ".css"],
        plugins: [postcssImport(), autoprefixer()],
        use: {
          sass: {
            silenceDeprecations: ["legacy-js-api"],
          },
        },
      }),
      terser(),
      copy({
        targets: [
          { src: "src/assets/fonts/**/*", dest: "dist/fonts" },
          { src: "src/assets/scss/mixins.scss", dest: "dist/" },
        ],
      }),
    ],
  },
  {
    input: "src/index.ts",
    output: [
      {
        file: "dist/index.d.ts",
        format: "es",
      },
    ],
    external: ["preact", "preact/hooks", "react", "react-dom", /\.s?css$/],
    plugins: [dts()],
  },
]);
