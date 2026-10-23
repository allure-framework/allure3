# Type validation

Run these commands from the repository root after `yarn build`, which produces the workspace declarations used by consumers:

- `yarn check`: formatting and lint, including type-aware rules across source, tests and scripts. The root scope includes `.mts` files.
- `yarn lint:type`: the same repository lint scope without the formatting check.
- `yarn typecheck`: runs `vp lint --type-check` for package `src` directories, adding compiler diagnostics to the existing lint rules. Source lint therefore also runs here, and any lint error can fail this command. It discovers source roots dynamically, lists packages without `src`, rejects an empty scope and excludes colocated `*.test.*` files. Other files under `src`, including fixtures or mocks, remain in scope.
- `yarn verify`: both `yarn check --quiet` and `yarn typecheck --quiet`; CI runs this after the root build. Errors block the job. Omit `--quiet` from the individual commands to inspect warnings.

Type-aware lint uses type information to check rules such as `await-thenable`; it is distinct from compiler diagnostics. Tests remain in the lint scope, but full compiler checking of test fixtures and mocks is a separate migration. The root `typeCheck: false` option prevents the all-file lint command from also enforcing that unfinished migration; `yarn typecheck` explicitly enables compiler checking for production.

The compiler check uses Vite+'s TypeScript Go engine. Package builds also retain their existing TypeScript build tooling. Explicit source `rootDir` values preserve package output paths, frontend module resolution uses `Bundler`, and standalone configurations explicitly retain their former strictness settings instead of adopting a new compiler default. Browser projects keep their browser-only ambient types. Unused development/test `tsconfig.node.json` files in Awesome and web-components were removed: they overlapped production sources, had no remaining consumers and prevented reliable production project ownership. Full test-project configuration belongs to the separate test-typing migration.

## History

- [PR #533](https://github.com/allure-framework/allure3/pull/533), March 6, 2026, introduced required type-aware lint in CI during the Oxc migration. This was typed lint, rather than the newer compiler diagnostic flag.
- [PR #681](https://github.com/allure-framework/allure3/pull/681), June 1, 2026, commented out that CI step during a dependency upgrade. The root command remained. The available PR discussion does not document the exact reason.
- [PR #1145](https://github.com/allure-framework/allure3/pull/1145), merged October 22, 2026, migrated CI to Vite+ checks and explicitly disabled both type-aware lint and compiler diagnostics with a TODO to fix their errors and re-enable them.

Restoration separates production compiler checking from repository-wide typed lint. Existing lint warnings remain visible when running without `--quiet`; a successful exit does not imply that the warning backlog has been resolved.
