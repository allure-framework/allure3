import type { StorybookConfig } from "@storybook/preact-webpack5";
import { fileURLToPath } from "node:url";
import { dirname, join } from "path";

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, "package.json")));
}

const baseDir = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  staticDirs: ["../src/assets"],
  addons: [
    getAbsolutePath("@storybook/addon-webpack5-compiler-swc"),
    getAbsolutePath("@storybook/addon-essentials"),
    getAbsolutePath("@chromatic-com/storybook"),
    getAbsolutePath("@storybook/addon-interactions"),
  ],
  framework: {
    name: getAbsolutePath("@storybook/preact-webpack5"),
    options: {},
  },
  webpackFinal: async (config) => {
    config.module!.rules = config.module!.rules!.filter(
      // @ts-ignore
      (rule) => !rule?.test?.toString()?.includes?.("scss"),
    );
    config!.resolve!.alias = {
      ...config.resolve!.alias,
      "@": join(baseDir, "./src"),
      "react": join(baseDir, "../../../node_modules/preact/compat"),
      "react-dom/test-utils": join(baseDir, "../../../node_modules/preact/test-utils"),
      "react-dom": join(baseDir, "../../../node_modules/preact/compat"),
      "react/jsx-runtime": join(baseDir, "../../../node_modules/preact/jsx-runtime"),
    };
    config.module!.rules.push({
      test: /\.scss$/,
      use: ["style-loader", "css-loader", "sass-loader"],
    });

    return config;
  },
};

export default config;
