import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export default {
  presets: [
    [
      require.resolve("@babel/preset-env"),
      {
        targets: {
          node: "current",
        },
      },
    ],
    [require.resolve("@babel/preset-typescript"), { isTSX: true, allExtensions: true, jsxPragma: "h" }],
  ],
  plugins: [
    [
      require.resolve("@babel/plugin-transform-react-jsx"),
      {
        runtime: "automatic",
        importSource: "preact",
      },
    ],
  ],
};
