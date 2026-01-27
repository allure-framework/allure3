// vitest.config.ts
import { createRequire } from "node:module";
import { defineConfig } from "file:///Users/epszaw/Code/Work/qameta/allure3/.yarn/__virtual__/vitest-virtual-d3f096a03d/0/cache/vitest-npm-2.1.9-da245b091d-28e061be0f.zip/node_modules/vitest/dist/config.js";
var __vite_injected_original_import_meta_url = "file:///Users/epszaw/Code/Work/qameta/allure3/packages/ci/vitest.config.ts";
var require2 = createRequire(__vite_injected_original_import_meta_url);
var vitest_config_default = defineConfig({
  test: {
    include: ["./test/**/*.test.ts"],
    setupFiles: [require2.resolve("allure-vitest/setup")],
    reporters: [
      "default",
      [
        "allure-vitest/reporter",
        {
          resultsDir: "./out/allure-results",
          globalLabels: [
            { name: "module", value: "ci" }
          ]
        }
      ]
    ]
  }
});
export {
  vitest_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZXN0LmNvbmZpZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9Vc2Vycy9lcHN6YXcvQ29kZS9Xb3JrL3FhbWV0YS9hbGx1cmUzL3BhY2thZ2VzL2NpXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvZXBzemF3L0NvZGUvV29yay9xYW1ldGEvYWxsdXJlMy9wYWNrYWdlcy9jaS92aXRlc3QuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy9lcHN6YXcvQ29kZS9Xb3JrL3FhbWV0YS9hbGx1cmUzL3BhY2thZ2VzL2NpL3ZpdGVzdC5jb25maWcudHNcIjtpbXBvcnQgeyBjcmVhdGVSZXF1aXJlIH0gZnJvbSBcIm5vZGU6bW9kdWxlXCI7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZXN0L2NvbmZpZ1wiO1xuXG5jb25zdCByZXF1aXJlID0gY3JlYXRlUmVxdWlyZShpbXBvcnQubWV0YS51cmwpO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICB0ZXN0OiB7XG4gICAgaW5jbHVkZTogW1wiLi90ZXN0LyoqLyoudGVzdC50c1wiXSxcbiAgICBzZXR1cEZpbGVzOiBbcmVxdWlyZS5yZXNvbHZlKFwiYWxsdXJlLXZpdGVzdC9zZXR1cFwiKV0sXG4gICAgcmVwb3J0ZXJzOiBbXG4gICAgICBcImRlZmF1bHRcIixcbiAgICAgIFtcbiAgICAgICAgXCJhbGx1cmUtdml0ZXN0L3JlcG9ydGVyXCIsXG4gICAgICAgIHtcbiAgICAgICAgICByZXN1bHRzRGlyOiBcIi4vb3V0L2FsbHVyZS1yZXN1bHRzXCIsXG4gICAgICAgICAgZ2xvYmFsTGFiZWxzOiBbXG4gICAgICAgICAgICB7IG5hbWU6IFwibW9kdWxlXCIsIHZhbHVlOiBcImNpXCIgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICBdLFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTRVLFNBQVMscUJBQXFCO0FBQzFXLFNBQVMsb0JBQW9CO0FBRGlMLElBQU0sMkNBQTJDO0FBRy9QLElBQU1BLFdBQVUsY0FBYyx3Q0FBZTtBQUU3QyxJQUFPLHdCQUFRLGFBQWE7QUFBQSxFQUMxQixNQUFNO0FBQUEsSUFDSixTQUFTLENBQUMscUJBQXFCO0FBQUEsSUFDL0IsWUFBWSxDQUFDQSxTQUFRLFFBQVEscUJBQXFCLENBQUM7QUFBQSxJQUNuRCxXQUFXO0FBQUEsTUFDVDtBQUFBLE1BQ0E7QUFBQSxRQUNFO0FBQUEsUUFDQTtBQUFBLFVBQ0UsWUFBWTtBQUFBLFVBQ1osY0FBYztBQUFBLFlBQ1osRUFBRSxNQUFNLFVBQVUsT0FBTyxLQUFLO0FBQUEsVUFDaEM7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFsicmVxdWlyZSJdCn0K
