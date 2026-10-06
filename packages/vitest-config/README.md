# Shared Vitest configuration

This private workspace provides the default unit-test configuration and merges coverage from unit test execution runs.

## Package configuration

```ts
import { defaultVitestConfig } from "@allurereport/vitest-config";

export default defaultVitestConfig();
```

`defaultVitestConfig(options)` can be called without arguments or with an object with optional fields:

- `include`: test discovery patterns, defaulting to `["./test/**/*.test.ts"]`.
- `globalLabels`: additional global Allure labels. By default, `module` and `feature` are set to the current package directory's name, and `epic` groups related packages as described below. Labels supplied here override defaults with the same name; other defaults are retained.
- `coverageFiles`: coverage include patterns, defaulting to `["src/**/*.{ts,tsx}"]`.

The default `epic` label groups packages by their directory name:

| Package directory    | Epic                   |
| -------------------- | ---------------------- |
| `core`, `core-*`     | `core`                 |
| `cli`, `cli-*`       | `cli`                  |
| `plugin-*`           | `plugins`              |
| `web-*`              | `web`                  |
| `reader`, `reader-*` | `reader`               |
| Other packages       | Package directory name |

Run Vitest from the package directory (as Yarn workspace scripts do), since the package name is derived from the current working directory. The `type=vitest` label is always added.

## Creating merged coverage report

From the repository root:

```sh
ENABLE_COVERAGE=true yarn test:unit && yarn coverage
```
