export default {
  presets: [
    [
      "@babel/preset-env",
      {
        targets: {
          node: "current",
        },
      },
    ],
    ["@babel/preset-typescript", { isTSX: true, allExtensions: true, jsxPragma: "h" }],
  ],
  plugins: [
    [
      "@babel/plugin-transform-react-jsx",
      {
        runtime: "automatic",
        importSource: "preact",
      },
    ],
  ],
};
