import alias from "@rollup/plugin-alias";
import { babel } from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import autoprefixer from "autoprefixer";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import postcssImport from "postcss-import";
import { defineConfig } from "rollup";
import copy from "rollup-plugin-copy";
import postcss from "rollup-plugin-postcss";
import svg from "rollup-plugin-svg-sprites";

const BASE_PATH = path.dirname(fileURLToPath(import.meta.url));
const SRC_PATH = path.resolve(BASE_PATH, "./src");

export default defineConfig({
  input: "src/index.ts", // Entry point of your design system
  output: [
    {
      dir: "dist",
      format: "esm",
      sourcemap: true, // Generate sourcemaps
    },
    {
      dir: "dist",
      format: "cjs",
      sourcemap: true,
    },
  ],
  external: ["preact", "preact/hooks"], // Mark Preact as external (users will provide it)
  plugins: [
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
      sourceMap: true,
      // declaration: true,
    }),
    babel({
      babelHelpers: "bundled",
      extensions: [".js", ".jsx", ".ts", ".tsx"],
      exclude: "**",
    }),
    svg(),
    postcss({
      modules: true,
      extract: true,
      minimize: true,
      extensions: [".scss", ".css"],
      plugins: [postcssImport(), autoprefixer()],
    }),
    terser(),
    copy({
      targets: [{ src: "src/assets/fonts/**/*", dest: "dist/fonts" }],
    }),
  ],
});
