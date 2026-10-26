# Type validation

Run validation from the repository root after `yarn build`, which produces the workspace declarations used by consumers:

- `yarn check`: formatting, type-aware lint and compiler diagnostics across the repository lint scope, including TypeScript source, tests, stories and `.mts` files.
- `yarn lint:type`: the same lint/compiler scope without formatting.
- `yarn typecheck`: explicitly requests compiler diagnostics through `vp lint --type-check`; existing lint rules also run and can fail this command.
- `yarn verify`: `yarn check --quiet`; CI runs this after the root build. Errors block the job. Omit `--quiet` to see the warning backlog.

Type-aware lint checks rules such as `await-thenable`; compiler diagnostics check TypeScript assignability, nullability and implicit types. Both are enabled in the root Vite+ configuration. The former production-only discovery script is no longer needed: test programs now have their own configurations, so the same validation checks both production and tests.

The compiler check uses Vite+'s TypeScript Go engine. Package builds retain their existing TypeScript tooling. Package source projects and standalone frontend, e2e and sandbox projects use `strict`. Test directories extend `tsconfig.test.json`; frontend tests also inherit their product's JSX and alias configuration. Colocated web-components tests and Allure2 browser tests are discovered through root project references. Stories and Storybook configuration have separate projects. Test projects use `noEmit` and do not change package output paths.

Browser production projects retain browser-only ambient types. DOM and Node types in test projects support jsdom, Playwright and fixture setup; they do not add Node globals to frontend production builds. Legacy/raw fixtures keep their original serialized shapes, with compatibility typed at their input boundary rather than suppressing compiler diagnostics globally.

## Deliberate boundaries

Root TypeScript configuration and scripts belong to `tsconfig.root.json`. It is referenced by the solution config so compiler diagnostics also cover `vite.config.ts`.

Public `ReportTreeLeaf.tooltips` values are optional: strict consumers must handle `string | undefined` when reading a tooltip by key. This reflects the existing sparse tooltip payloads.

`strict` does not enable every optional TypeScript check; options such as `noUncheckedIndexedAccess` are separate decisions. Existing typed-lint warnings remain visible without `--quiet` and are not counted as fixed by this migration. JavaScript remains in the lint scope; compiler coverage follows each TypeScript project's JS settings.

Category resolution-tooltip propagation and the difference between flattened historical errors and current-result errors remain separate behavior changes. This validation work does not unify those data formats.

## History

- [PR #533](https://github.com/allure-framework/allure3/pull/533), March 6, 2026, introduced required type-aware lint in CI during the Oxc migration. This was typed lint, rather than the newer compiler diagnostic flag.
- [PR #681](https://github.com/allure-framework/allure3/pull/681), June 1, 2026, commented out that CI step during a dependency upgrade. The root command remained. The available PR discussion does not document the exact reason.
- [PR #1145](https://github.com/allure-framework/allure3/pull/1145), merged October 22, 2026, migrated CI to Vite+ checks and explicitly disabled both type-aware lint and compiler diagnostics with a TODO to fix their errors and re-enable them.
- The first restoration separated production compiler checking from repository-wide typed lint. The following test-typing migration gives tests their own strict projects and enables repository-wide compiler diagnostics in the shared CI command.
