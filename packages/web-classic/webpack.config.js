import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");
const { WebpackManifestPlugin } = require("webpack-manifest-plugin");

const baseDir = dirname(fileURLToPath(import.meta.url));

export default (env, argv) => {
  const devMode = argv?.mode === "development";
  const config = {
    entry: "./src/index.tsx",
    output: {
      path: join(baseDir, "dist/multi"),
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
          use: ["style-loader", "css-loader"],
        },
        {
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
        },
        {
          test: /\.svg$/,
          type: devMode ? "asset/resource" : "asset/inline",
        },
        {
          test: /\.(png|jpe?g|gif|woff2?|otf|ttf)$/i,
          type: devMode ? "asset/resource" : "asset/inline",
        },
      ],
    },
    devServer: {
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
      }),
      new WebpackManifestPlugin({
        publicPath: "",
      }),
    ],
    resolve: {
      modules: ["node_modules"],
      extensions: [".js", ".ts", ".tsx"],
      alias: {
        "@": join(baseDir, "src"),
      },
    },
    externals: {
      // Some packages use crypto from node:crypto, but webpack doesn't support it
      // I think this does not end up in a bundle, so it is safe to do this
      "node:crypto": "crypto",
    },
  };

  if (!devMode) {
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
