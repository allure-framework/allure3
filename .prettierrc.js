/** @type {import("prettier").Options} */
module.exports = {
  trailingComma: "all",
  singleQuote: false,
  arrowParens: "always",
  plugins: [require.resolve("@trivago/prettier-plugin-sort-imports"), require.resolve("prettier-plugin-packagejson")],
  printWidth: 120,
  importOrder: ["<THIRD_PARTY_MODULES>", "^@/(.*)$", "^[./]"],
  importOrderSeparation: false,
  importOrderSortSpecifiers: true,
  importOrderParserPlugins: ["typescript", "jsx", "decorators-legacy"],
  quoteProps: "consistent",
};
