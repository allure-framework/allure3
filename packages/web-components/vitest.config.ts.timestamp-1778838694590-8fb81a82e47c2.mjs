// vitest.config.ts
import { createRequire } from "node:module";
import * as path from "node:path";
import { defineConfig } from "file:///Users/anovikov/VSC/allure3-open/.yarn/__virtual__/vitest-virtual-2a0ab9e4ee/0/cache/vitest-npm-2.1.9-da245b091d-28e061be0f.zip/node_modules/vitest/dist/config.js";
var __vite_injected_original_dirname = "/Users/anovikov/VSC/allure3-open/packages/web-components";
var __vite_injected_original_import_meta_url = "file:///Users/anovikov/VSC/allure3-open/packages/web-components/vitest.config.ts";
var require2 = createRequire(__vite_injected_original_import_meta_url);
var vitest_config_default = defineConfig({
  test: {
    environment: "jsdom",
    include: ["./src/**/*.test.tsx", "./src/**/*.test.ts"],
    setupFiles: [require2.resolve("allure-vitest/setup")],
    reporters: [
      "default",
      [
        "allure-vitest/reporter",
        {
          resultsDir: "./out/allure-results",
          globalLabels: [
            { name: "module", value: "web-components" },
            { name: "coverage", value: "ui-components" },
            { name: "epic", value: "coverage" },
            { name: "feature", value: "ui-components" }
          ]
        }
      ]
    ],
    maxWorkers: 1,
    minWorkers: 1
  },
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src"),
      "react": "preact/compat",
      "react-dom": "preact/compat"
    }
  }
});
export {
  vitest_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZXN0LmNvbmZpZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9Vc2Vycy9hbm92aWtvdi9WU0MvYWxsdXJlMy1vcGVuL3BhY2thZ2VzL3dlYi1jb21wb25lbnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvYW5vdmlrb3YvVlNDL2FsbHVyZTMtb3Blbi9wYWNrYWdlcy93ZWItY29tcG9uZW50cy92aXRlc3QuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy9hbm92aWtvdi9WU0MvYWxsdXJlMy1vcGVuL3BhY2thZ2VzL3dlYi1jb21wb25lbnRzL3ZpdGVzdC5jb25maWcudHNcIjtpbXBvcnQgeyBjcmVhdGVSZXF1aXJlIH0gZnJvbSBcIm5vZGU6bW9kdWxlXCI7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gXCJub2RlOnBhdGhcIjtcblxuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVzdC9jb25maWdcIjtcblxuY29uc3QgcmVxdWlyZSA9IGNyZWF0ZVJlcXVpcmUoaW1wb3J0Lm1ldGEudXJsKTtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgdGVzdDoge1xuICAgIGVudmlyb25tZW50OiBcImpzZG9tXCIsXG4gICAgaW5jbHVkZTogW1wiLi9zcmMvKiovKi50ZXN0LnRzeFwiLCBcIi4vc3JjLyoqLyoudGVzdC50c1wiXSxcbiAgICBzZXR1cEZpbGVzOiBbcmVxdWlyZS5yZXNvbHZlKFwiYWxsdXJlLXZpdGVzdC9zZXR1cFwiKV0sXG4gICAgcmVwb3J0ZXJzOiBbXG4gICAgICBcImRlZmF1bHRcIixcbiAgICAgIFtcbiAgICAgICAgXCJhbGx1cmUtdml0ZXN0L3JlcG9ydGVyXCIsXG4gICAgICAgIHtcbiAgICAgICAgICByZXN1bHRzRGlyOiBcIi4vb3V0L2FsbHVyZS1yZXN1bHRzXCIsXG4gICAgICAgICAgZ2xvYmFsTGFiZWxzOiBbXG4gICAgICAgICAgICB7IG5hbWU6IFwibW9kdWxlXCIsIHZhbHVlOiBcIndlYi1jb21wb25lbnRzXCIgfSxcbiAgICAgICAgICAgIHsgbmFtZTogXCJjb3ZlcmFnZVwiLCB2YWx1ZTogXCJ1aS1jb21wb25lbnRzXCIgfSxcbiAgICAgICAgICAgIHsgbmFtZTogXCJlcGljXCIsIHZhbHVlOiBcImNvdmVyYWdlXCIgfSxcbiAgICAgICAgICAgIHsgbmFtZTogXCJmZWF0dXJlXCIsIHZhbHVlOiBcInVpLWNvbXBvbmVudHNcIiB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIF0sXG4gICAgbWF4V29ya2VyczogMSxcbiAgICBtaW5Xb3JrZXJzOiAxLFxuICB9LFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxuICAgICAgXCJyZWFjdFwiOiBcInByZWFjdC9jb21wYXRcIixcbiAgICAgIFwicmVhY3QtZG9tXCI6IFwicHJlYWN0L2NvbXBhdFwiLFxuICAgIH0sXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBOFYsU0FBUyxxQkFBcUI7QUFDNVgsWUFBWSxVQUFVO0FBRXRCLFNBQVMsb0JBQW9CO0FBSDdCLElBQU0sbUNBQW1DO0FBQWlMLElBQU0sMkNBQTJDO0FBSzNRLElBQU1BLFdBQVUsY0FBYyx3Q0FBZTtBQUU3QyxJQUFPLHdCQUFRLGFBQWE7QUFBQSxFQUMxQixNQUFNO0FBQUEsSUFDSixhQUFhO0FBQUEsSUFDYixTQUFTLENBQUMsdUJBQXVCLG9CQUFvQjtBQUFBLElBQ3JELFlBQVksQ0FBQ0EsU0FBUSxRQUFRLHFCQUFxQixDQUFDO0FBQUEsSUFDbkQsV0FBVztBQUFBLE1BQ1Q7QUFBQSxNQUNBO0FBQUEsUUFDRTtBQUFBLFFBQ0E7QUFBQSxVQUNFLFlBQVk7QUFBQSxVQUNaLGNBQWM7QUFBQSxZQUNaLEVBQUUsTUFBTSxVQUFVLE9BQU8saUJBQWlCO0FBQUEsWUFDMUMsRUFBRSxNQUFNLFlBQVksT0FBTyxnQkFBZ0I7QUFBQSxZQUMzQyxFQUFFLE1BQU0sUUFBUSxPQUFPLFdBQVc7QUFBQSxZQUNsQyxFQUFFLE1BQU0sV0FBVyxPQUFPLGdCQUFnQjtBQUFBLFVBQzVDO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsSUFDQSxZQUFZO0FBQUEsSUFDWixZQUFZO0FBQUEsRUFDZDtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBVSxhQUFRLGtDQUFXLE9BQU87QUFBQSxNQUNwQyxTQUFTO0FBQUEsTUFDVCxhQUFhO0FBQUEsSUFDZjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogWyJyZXF1aXJlIl0KfQo=
