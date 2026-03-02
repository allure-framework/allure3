import HtmlWebpackPlugin from "html-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import { dirname, join, resolve } from "node:path";
import { env } from "node:process";
import { fileURLToPath } from "node:url";
import SpriteLoaderPlugin from "svg-sprite-loader/plugin.js";
import webpack from "webpack";
import { WebpackManifestPlugin } from "webpack-manifest-plugin";

const { SINGLE_FILE_MODE } = env;
const baseDir = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = resolve(baseDir, "..", "..");
const apiBaseUrl = process.env.API_BASE_URL || env.API_BASE_URL || "http://localhost:3000";

export default (env, argv) => {
  const devMode = argv?.mode === "development";
  const config = {
    context: baseDir,
    entry: "./src/index.tsx",
    output: {
      path: join(baseDir, SINGLE_FILE_MODE ? "dist/single" : "dist/multi"),
      filename: devMode ? "app.js" : "app-[fullhash].js",
      assetModuleFilename: "[name][ext]",
    },
    devtool: devMode ? "inline-source-map" : false,
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "babel-loader",
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [SINGLE_FILE_MODE ? "style-loader" : MiniCssExtractPlugin.loader, "css-loader"],
        },
        {
          test: /\.scss$/,
          use: [
            SINGLE_FILE_MODE ? "style-loader" : MiniCssExtractPlugin.loader,
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
        },
        {
          test: /\.svg$/,
          loader: "svg-sprite-loader",
        },
        {
          test: /\.(png|jpe?g|gif|woff2?|otf|ttf)$/i,
          type: SINGLE_FILE_MODE ? "asset/inline" : "asset/resource",
        },
      ],
    },
    devServer: {
      port: 8080,
      hot: true,
      static: "./out/dev",
      historyApiFallback: true,
      watchFiles: ["./src"],
      devMiddleware: {
        index: true,
        mimeTypes: { phtml: "text/html" },
        serverSideRender: false,
      },
    },
    plugins: [
      new webpack.DefinePlugin({
        DEVELOPMENT: devMode,
        __ALLURE_API_BASE_URL__: JSON.stringify(apiBaseUrl),
      }),
      new MiniCssExtractPlugin({
        filename: devMode ? "styles.css" : "styles-[contenthash].css",
      }),
      new SpriteLoaderPlugin(),
      new WebpackManifestPlugin({
        publicPath: "",
      }),
    ],
    resolve: {
      modules: [resolve(monorepoRoot, "node_modules"), "node_modules"],
      extensions: [".js", ".ts", ".tsx"],
      alias: {
        "@": join(baseDir, "src"),
        "@allurereport/web-components": resolve(monorepoRoot, "node_modules/@allurereport/web-components/dist"),
        "@allurereport/core-api": resolve(monorepoRoot, "node_modules/@allurereport/core-api"),
        "@allurereport/charts-api": resolve(monorepoRoot, "node_modules/@allurereport/charts-api"),
        "@allurereport/web-commons": resolve(monorepoRoot, "node_modules/@allurereport/web-commons"),
      },
    },
    externals: {
      // Some packages use crypto from node:crypto, but webpack doesn't support it
      // I think this does not end up in a bundle, so it is safe to do this
      "node:crypto": "crypto",
    },
  };

  if (SINGLE_FILE_MODE) {
    config.plugins.push(
      new webpack.optimize.LimitChunkCountPlugin({
        maxChunks: 1,
      }),
    );
  }

  if (devMode) {
    config.plugins.push(
      new HtmlWebpackPlugin({
        template: "src/index.html",
      }),
    );
  }

  return config;
};
