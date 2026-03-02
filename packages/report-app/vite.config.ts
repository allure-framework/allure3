import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const baseDir = dirname(fileURLToPath(import.meta.url));
const webAwesomeSrc = resolve(baseDir, "..", "web-awesome", "src");
const webComponentsPkg = resolve(baseDir, "..", "web-components");

export default defineConfig({
  plugins: [
    preact(),
    nodePolyfills({ include: ["crypto", "util", "stream"], protocolImports: true }),
  ],
  resolve: {
    alias: {
      "@": webAwesomeSrc,
      // So that web-awesome (and classic) scss can resolve ~@allurereport/web-components/mixins.scss
      "~@allurereport/web-components": resolve(webComponentsPkg, "src", "assets", "scss"),
      // Fonts are in dist (or src/assets/fonts); url() in mixins uses .../fonts/...
      "@allurereport/web-components/fonts": resolve(webComponentsPkg, "dist", "fonts"),
      "@allurereport/web-components": webComponentsPkg,
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        loadPaths: [webComponentsPkg, resolve(webComponentsPkg, "dist")],
        silenceDeprecations: ["legacy-js-api"],
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      input: resolve(baseDir, "index.html"),
    },
  },
  server: {
    port: 5174,
    strictPort: false,
  },
});
