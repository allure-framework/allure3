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
    [
      "prismjs",
      {
        languages: [
          "javascript",
          "css",
          "html",
          "typescript",
          "csv",
          "json",
          "java",
          "csharp",
          "kotlin",
          "python",
          "ruby",
          "gherkin",
          "go",
          "php",
        ],
        plugins: ["line-numbers", "show-language"],
        theme: "default",
        css: true,
      },
    ],
  ],
};
