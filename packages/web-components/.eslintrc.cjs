module.exports = {
  env: { browser: true, es2020: true },
  extends: [
    "eslint-config-preact",
    "../../.eslintrc.cjs",
  ],
  ignorePatterns: ["dist/", ".eslintrc.cjs", "postcss.config.js", "webpack.config.js", "types.d.ts"],
  parser: "@typescript-eslint/parser",
  overrides: [
    {
      extends: ["plugin:@typescript-eslint/disable-type-checked"],
      files: [".eslintrc.cjs", ".babelrc.js"],
    },
    {
      files: ["stories/**/*.stories.tsx"],
      rules: {
        "no-console": "off",
        "react-hooks/rules-of-hooks": "off",
        "react-hooks/exhaustive-deps": "off",
      },
    }
  ],
  rules: {
    "n/file-extension-in-import": "off"
  }
};
