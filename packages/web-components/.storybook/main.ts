import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { StorybookConfig } from "@storybook/preact-vite";
import svgrJsx from "@svgr/plugin-jsx";
import svgrSvgo from "@svgr/plugin-svgo";
import autoprefixer from "autoprefixer";
import type { PluginCreator } from "postcss";
import postcssImport from "postcss-import";
import { type Plugin, mergeConfig } from "vite";
import svgr from "vite-plugin-svgr";

import { svgrOptions } from "../svgr.config.js";

const require = createRequire(import.meta.url);

/**
 * Resolves the absolute path of a package, required under Yarn PnP and in monorepos.
 */
const getAbsolutePath = (value: string): any => dirname(require.resolve(join(value, "package.json")));

const scssModuleImport = /^(\s*import\s+\w+\s+from\s+["'][^"']+\.scss)(["'])/gm;

/**
 * Rollup build treats every imported stylesheet as a CSS module, while Vite only does it for `.module.*` files.
 * Stylesheets imported with a binding are switched to modules here, side-effect imports stay global.
 */
const scssModules = (): Plugin => ({
  name: "allure-scss-modules",
  enforce: "pre",
  transform(code, id) {
    if (!/\.(tsx?|jsx?)$/.test(id) || id.includes("node_modules")) {
      return null;
    }

    return code.replace(scssModuleImport, "$1?.module.scss$2");
  },
});

const globalStylesDir = join(dirname(fileURLToPath(import.meta.url)), "../src/assets/scss");

/**
 * Global theme styles are not CSS modules in Vite, so `:global(...)` wrappers have to be removed manually.
 */
const unwrapGlobalSelectors: PluginCreator<unknown> = () => ({
  postcssPlugin: "allure-unwrap-global-selectors",
  Rule(rule) {
    if (rule.source?.input.file?.startsWith(globalStylesDir)) {
      rule.selector = rule.selector.replace(/:global\(([^)]*)\)/g, "$1");
    }
  },
});
unwrapGlobalSelectors.postcss = true;

const baseDir = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  staticDirs: ["../src/assets"],
  addons: [getAbsolutePath("@storybook/addon-docs")],
  framework: getAbsolutePath("@storybook/preact-vite"),
  viteFinal: async (viteConfig) =>
    mergeConfig(viteConfig, {
      resolve: {
        alias: {
          "@": join(baseDir, "../src"),
          "node:crypto": join(baseDir, "node-crypto-shim.ts"),
        },
      },
      css: {
        postcss: { plugins: [postcssImport(), unwrapGlobalSelectors(), autoprefixer()] },
        preprocessorOptions: {
          scss: { api: "modern-compiler" },
        },
      },
      plugins: [
        scssModules(),
        svgr({
          include: "**/assets/svg/*.svg",
          svgrOptions: { ...svgrOptions, plugins: [svgrSvgo, svgrJsx] },
        }),
      ],
    }),
};

export default config;
