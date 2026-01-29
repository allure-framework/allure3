import type { StorybookConfig } from "@storybook/preact-webpack5";
import autoprefixer from "autoprefixer";
import { fileURLToPath } from "node:url";
import { dirname, join } from "path";
import postcssImport from "postcss-import";

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
    config!.resolve!.alias = {
      ...config.resolve!.alias,
      "@": join(baseDir, "../src"),
    };

    config.module!.rules!.push({
      test: /\.scss$/,
      use: [
        "style-loader",
        {
          loader: "css-loader",
          options: {
            importLoaders: 2, // postcss-loader and sass-loader
            esModule: false,
            modules: {
              exportLocalsConvention: "asIs", // Keep class names as-is, don't convert to camelCase
            },
          },
        },
        {
          loader: "postcss-loader",
          options: {
            postcssOptions: {
              plugins: [postcssImport(), autoprefixer()],
            },
          },
        },
        {
          loader: "sass-loader",
          options: {
            api: "modern-compiler",
            sassOptions: {
              silenceDeprecations: ["legacy-js-api"],
            },
          },
        },
      ],
    });

    config.externals = {
      // @ts-expect-error this is fine
      ...(config.externals || {}),
      // Some packages use crypto from node:crypto, but webpack doesn't support it
      // I think this does not end up in a bundle, so it is safe to do this
      "node:crypto": "crypto",
    };

    config.resolve!.extensionAlias = {
      ...(config.resolve?.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };

    return config;
  },
};

export default config;
