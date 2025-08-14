module.exports = {
  env: {browser: true, es2020: true},
  extends: [
    "eslint-config-preact",
    "../../.eslintrc.cjs",
  ],
  ignorePatterns: ["dist", ".eslintrc.cjs", "postcss.config.js", "webpack.config.js", "types.d.ts"],
  parser: "@typescript-eslint/parser",
  overrides: [
    {
      extends: ["plugin:@typescript-eslint/disable-type-checked"],
      files: [".eslintrc.cjs", ".babelrc.js"],
    },
  ],
  rules: {
    "n/file-extension-in-import": "off",
    "@typescript-eslint/consistent-type-imports": ["error", {
      fixStyle: 'separate-type-imports',
      prefer: 'type-imports',
    }],
  }
};
