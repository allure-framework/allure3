module.exports = {
  env: { browser: true, es2020: true },
  extends: ["../../.eslintrc.cjs"],
  ignorePatterns: ["dist", ".eslintrc.cjs"],
  parser: "@typescript-eslint/parser",
  overrides: [
    {
      extends: ["plugin:@typescript-eslint/disable-type-checked"],
      files: [".eslintrc.cjs"],
    },

  ],
};
