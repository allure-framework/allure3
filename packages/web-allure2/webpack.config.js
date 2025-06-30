import MiniCssExtractPlugin from "mini-css-extract-plugin";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { env } from "node:process";
import { fileURLToPath } from "node:url";
import SpriteLoaderPlugin from "svg-sprite-loader/plugin.js";
import webpack from "webpack";
import { WebpackManifestPlugin } from "webpack-manifest-plugin";
import * as utils from "./webpack/utils.js";

const { SINGLE_FILE_MODE } = env;
const buildHash = randomBytes(8).toString("hex");
const baseDir = dirname(fileURLToPath(import.meta.url));

export default (env, argv) => {
  const config = {
    entry: "./src/index.js",
    output: {
      path: join(baseDir, SINGLE_FILE_MODE ? "dist/single" : "dist/multi"),
      filename: "main.js",
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
        // FIXME: how can we solve the problem with svg in css?
        // {
        //   test: /\.svg$/,
        //   type: "asset/inline",
        //   resourceQuery: /inline/,
        // },
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
        filename: "main.css",
      }),
      new SpriteLoaderPlugin(),
      new WebpackManifestPlugin({
        publicPath: "",
        generate: (seed, files) => {
          const manifest = Object.entries(files).reduce(
            (acc, [, file]) => ({
              ...acc,
              [file.path]: `${file.path}?v=${buildHash}`,
            }),
            {},
          );

          return manifest;
        },
      }),
    ],
    resolve: {
      modules: ["node_modules"],
      extensions: [".js", ".json"],
      alias: {
        "@": join(baseDir, "src"),
      },
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
