import MiniCssExtractPlugin from "mini-css-extract-plugin";
import { dirname, join } from "node:path";
import { env } from "node:process";
import { fileURLToPath } from "node:url";
import SpriteLoaderPlugin from "svg-sprite-loader/plugin.js";
import webpack from "webpack";
import { WebpackManifestPlugin } from "webpack-manifest-plugin";
import * as utils from "./webpack/utils.js";

const { SINGLE_FILE_MODE } = env;
const __dirname = dirname(fileURLToPath(import.meta.url));

export default (env, argv) => {
  const devMode = argv?.mode === "development";
  const config = {
    entry: "./src/index.js",
    output: {
      path: join(__dirname, SINGLE_FILE_MODE ? "dist/single" : "dist/multi"),
      filename: devMode ? "app.js" : "app-[fullhash].js",
      assetModuleFilename: "[name][ext]",
    },
    module: {
      rules: [
        {
          test: /\.(ts|js)x?$/,
          use: "babel-loader",
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, "css-loader"],
        },
        {
          test: /\.scss$/,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: "css-loader",
              // TODO: uncomment when we'll start migration to preact
              // options: {
              //   modules: true,
              // },
            },
            {
              loader: "sass-loader",
              options: {
                api: "modern",
              },
            },
          ],
        },
        {
          test: /\.hbs$/,
          use: {
            loader: "handlebars-loader",
            options: {
              helperDirs: [utils.root("src/helpers"), utils.root("src/blocks")],
            },
          },
        },
        {
          test: /translations\/\D+\.json$/,
          type: "asset/source",
        },
        {
          test: /\.svg$/,
          loader: "svg-sprite-loader",
        },
        {
          test: /\.(ico)(\?.*)?$/,
          loader: "file-loader",
        },
        {
          test: /\.(png|jpe?g|gif|woff2?|otf|ttf|eot)$/i,
          type: SINGLE_FILE_MODE ? "asset/inline" : "asset/resource",
        },
      ],
    },
    devServer: {
      open: true,
      hot: true,
    },
    plugins: [
      new webpack.DefinePlugin({
        "DEVELOPMENT": argv?.mode === "development",
        "process.env": {
          DEBUG_INFO_ENABLED: argv?.mode === "development",
        },
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
      modules: ["node_modules"],
      extensions: [".js", ".json"],
      alias: {
        "@": join(__dirname, "src"),
      },
    },
    externals: {
      // Some packages use crypto from node:crypto, but webpack doesn't support it
      // I think this does not end up in a bundle, so it is safe to do this
      "node:crypto": "crypto",
    },
  };

  if (SINGLE_FILE_MODE) {
    config.optimization = {
      splitChunks: false,
    };
    config.plugins.push(
      new webpack.optimize.LimitChunkCountPlugin({
        maxChunks: 1,
      }),
    );
  }

  return config;
};
