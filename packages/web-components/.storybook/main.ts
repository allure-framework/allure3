import type { StorybookConfig } from "@storybook/preact-webpack5";
import autoprefixer from "autoprefixer";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

    // SCSS support (CSS modules, PostCSS, Sass)
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

    // Use SVG sprite for icons from src/assets/svg (similar to rollup-plugin-svg-sprites)
    const svgIconsDir = join(baseDir, "../src/assets/svg");

    // Exclude our icons directory from the default Storybook SVG rule (if it exists)
    const svgRule = config.module!.rules!.find(
      (rule) =>
        typeof rule === "object" &&
        !!(rule as any).test &&
        (rule as any).test.toString().includes("svg"),
    ) as any;

    if (svgRule) {
      const existingExclude = svgRule.exclude;
      if (Array.isArray(existingExclude)) {
        svgRule.exclude = [...existingExclude, svgIconsDir];
      } else if (existingExclude) {
        svgRule.exclude = [existingExclude, svgIconsDir];
      } else {
        svgRule.exclude = [svgIconsDir];
      }
    }

    // Add svg-sprite-loader for icons used by SvgIcon component
    config.module!.rules!.push({
      test: /\.svg$/,
      include: [svgIconsDir],
      use: [
        {
          loader: require.resolve("svg-sprite-loader"),
          options: {
            // icon.id will be used inside <use xlinkHref={`#${id}`} />
            symbolId: "[name]",
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
