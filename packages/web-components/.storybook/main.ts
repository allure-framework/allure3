import type { StorybookConfig } from "@storybook/preact-webpack5";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "path";

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, "package.json")));
}
const baseDir = dirname(fileURLToPath(import.meta.url));

// @ts-ignore
const devMode = process?.mode === "development";

const config: StorybookConfig = {
  // stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  stories: ["../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
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
      "@": join(baseDir, "../src"),
    };
    // Add SCSS support
    config.module!.rules.push({
      test: /\.scss$/,
      use: [
        "style-loader",
        {
          loader: "css-loader",
          options: {
            modules: {
              localIdentName: devMode ? "[path][name]__[local]" : "[hash:base64:8]",
            },
          },
        },
        "sass-loader",
      ],
      include: resolve(__dirname, "../"),
    });

    return config;
  },
};

export default config;
