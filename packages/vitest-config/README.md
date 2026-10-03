# Shared Vitest configuration

This private workspace provides the default unit-test configuration and merges coverage from independently cached package runs, following the [Turborepo Vitest guide](https://turborepo.dev/docs/guides/tools/vitest#creating-merged-coverage-reports).

## Package configuration

```ts
import { defaultVitestConfig } from "@allurereport/vitest-config";

export default defaultVitestConfig({
  globalLabels: [{ name: "module", value: "my-package" }],
});
```

`defaultVitestConfig(options)` accepts an object with optional fields:

- `include`: test discovery patterns, defaulting to `["./test/**/*.test.ts"]`.
- `globalLabels`: global Allure labels, defaulting to `[]`.
- `coverageFiles`: coverage include patterns, defaulting to `["src/**/*.{ts,tsx}"]`.

## Merged coverage

From the repository root:

```sh
yarn coverage
```

`yarn coverage` first runs `turbo run test:unit`, which builds dependencies and runs or restores each package's tests. The coverage is collected only from workspaces that use `vitest` and define script `test:unit` in their `package.json` file.

The `coverage:merge` task collects blobs in a clean, flat directory with unique filenames. The `coverage:report` task then invokes `vitest run --merge-reports`
