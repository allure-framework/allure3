module.exports = {
  env: { es2020: true },
  extends: ["../../.eslintrc.cjs"],
  ignorePatterns: ["dist", ".eslintrc.cjs"],
  parser: "@typescript-eslint/parser",
  overrides: [
    {
      extends: ["plugin:@typescript-eslint/disable-type-checked"],
      files: [".eslintrc.cjs"],
    },
    {
      files: ["src/**/*.ts"],
      rules: {
        "prefer-arrow/prefer-arrow-functions": "off",
      },
    },
    {
      files: ["tests/**/*.test.ts"],
      rules: {
        "prefer-arrow/prefer-arrow-functions": "off",
        "no-console": "off",
        "no-underscore-dangle": "off",
        "prefer-template": "off",
        "@typescript-eslint/no-unused-vars": "off",
        "@typescript-eslint/array-type": "off",
      },
    },
  ],
};
