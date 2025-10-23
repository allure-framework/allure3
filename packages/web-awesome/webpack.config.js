import ForkTsCheckerPlugin from "fork-ts-checker-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import { dirname, join } from "node:path";
import { env } from "node:process";
import { fileURLToPath } from "node:url";
import SpriteLoaderPlugin from "svg-sprite-loader/plugin.js";
import TerserPlugin from "terser-webpack-plugin";
import webpack from "webpack";
import { WebpackManifestPlugin } from "webpack-manifest-plugin";

const { SINGLE_FILE_MODE } = env;
const baseDir = dirname(fileURLToPath(import.meta.url));

export default (env, argv) => {
  const devMode = argv?.mode === "development";
  const config = {
    entry: "./src/index.tsx",
    output: {
      path: join(baseDir, SINGLE_FILE_MODE ? "dist/single" : "dist/multi"),
      filename: devMode ? "app.js" : "app-[fullhash].js",
      assetModuleFilename: "[name][ext]",
    },
    devtool: devMode ? "inline-source-map" : false,
    optimization: {
      minimize: !devMode,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: false,
              drop_debugger: false,
            },
          },
        }),
      ],
    },
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
      new ForkTsCheckerPlugin(),
      new webpack.DefinePlugin({
        DEVELOPMENT: devMode,
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
      extensions: [".js", ".ts", ".tsx"],
      alias: {
        "@": join(baseDir, "src"),
        "react": "@preact/compat",
        "react-dom": "@preact/compat",
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
