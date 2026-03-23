import { readFileSync } from "node:fs";

import { build } from "esbuild";

const pkg = JSON.parse(readFileSync("./package.json", "utf8"));

await build({
  entryPoints: ["./src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "./dist/index.js",
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  define: {
    __PKG_VERSION__: JSON.stringify(pkg.version),
  },
  external: [],
});
