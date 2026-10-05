# Shared Vitest configuration

This private workspace provides the default unit-test configuration and merges coverage from unit test execution runs.

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

## Creating merged coverage report

From the repository root:

```sh
ENABLE_COVERAGE=true yarn test:unit && yarn coverage
```
