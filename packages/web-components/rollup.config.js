import alias from "@rollup/plugin-alias";
import { babel } from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import autoprefixer from "autoprefixer";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import postcssImport from "postcss-import";
import { defineConfig } from "rollup";
import dts from "rollup-plugin-dts";
import postcss from "rollup-plugin-postcss";
import svg from "rollup-plugin-svg-sprites";

const BASE_PATH = path.dirname(fileURLToPath(import.meta.url));
const SRC_PATH = path.resolve(BASE_PATH, "./src");

async function* walkFiles(rootDir) {
  const dirents = await fs.readdir(rootDir, { withFileTypes: true });
  for (const dirent of dirents) {
    const absolutePath = path.join(rootDir, dirent.name);
    if (dirent.isDirectory()) {
      yield* walkFiles(absolutePath);
      continue;
    }
    if (dirent.isFile()) yield absolutePath;
  }
}

function copyAssets({ targets = [] } = {}) {
  return {
    name: "inline-copy-assets",
    async buildStart() {
      for (const target of targets) {
        if (target.type === "file") {
          this.addWatchFile(target.src);
          continue;
        }
        for await (const filePath of walkFiles(target.srcDir)) {
          this.addWatchFile(filePath);
        }
      }
    },
    async generateBundle() {
      for (const target of targets) {
        if (target.type === "file") {
          const source = await fs.readFile(target.src);
          const fileName = path.posix.join(target.destDir, path.basename(target.src));
          this.emitFile({ type: "asset", fileName, source });
          continue;
        }

        for await (const filePath of walkFiles(target.srcDir)) {
          const relativeToDir = path.relative(target.srcDir, filePath);
          const source = await fs.readFile(filePath);
          const fileName = path.posix.join(target.destDir, relativeToDir.split(path.sep).join(path.posix.sep));
          this.emitFile({ type: "asset", fileName, source });
        }
      }
    },
  };
}

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
    external: ["preact", "preact/hooks", "@preact/compat", "@preact/signals", "@preact/signals/utils", "react", "react-dom"],
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
        exclude: ["**/*.test.tsx", "**/*.test.ts"],
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
      copyAssets({
        targets: [
          {
            type: "dir",
            srcDir: path.resolve(BASE_PATH, "src/assets/fonts"),
            destDir: "fonts",
          },
          {
            type: "file",
            src: path.resolve(BASE_PATH, "src/assets/scss/mixins.scss"),
            destDir: "",
          },
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
