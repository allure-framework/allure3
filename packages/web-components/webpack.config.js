import MiniCssExtractPlugin from "mini-css-extract-plugin";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const baseDir = dirname(fileURLToPath(import.meta.url));
export default {
  entry: "./src/index.ts",
  output: {
    path: join(baseDir, "dist"),
    filename: "index.js",
    library: {
      name: "@allurereport/web-components",
      type: "umd",
      export: "default",
    },

    clean: true,
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "styles-[hash:8].css",
    }),
  ],
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".scss"],
    alias: {
      "@": join(baseDir, "src"),
    },
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
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
      {
        test: /\.scss$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: "css-loader",
            options: {
              modules: {
                localIdentName: "[hash:base64:8]",
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
        type: "asset/resource",
      },
    ],
  },
  mode: "development",
};
