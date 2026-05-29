# Project Guide

Use [Allure Agent Mode](docs/allure-agent-mode.md) for all test-related work in this repository.

- Read `docs/allure-agent-mode.md` before designing, writing, reviewing, validating, debugging, or enriching tests.
- If a command executes tests and its result will be used for smoke checking, reasoning, review, coverage analysis, debugging, or any user-facing conclusion, run it through `allure agent`. It preserves the original console logs and adds agent-mode artifacts without inheriting the normal report or export plugins from the project config.
- Use `allure agent` for smoke checks too, even when the change is small or mechanical.
- After changing a package in this repository, treat package builds as part of validation and run the changed package build command before finalizing (for example, `yarn workspace <package-name> build`), because type-level regressions can break builds.
- **Workspace build order:** dependency edges come from each package's `dependencies` (including `workspace:*` links to other packages). The root `yarn build` script runs `yarn workspaces foreach -Avvpt run build`, where `-t`/`--topological` schedules a workspace only after its regular `dependencies` have built successfully (parallelism `-p` is within those constraints). For a single touched package, `yarn workspace <package-name> build` is enough; when several packages change or downstream breakage is possible, prefer a full **`yarn build`** at the repo root so Yarn applies the same topological order as CI.
- **Lint, format, and type-aware lint:** before finalizing code changes, align with the `lint` job in `.github/workflows/build.yml`: run **`yarn build`**, then **`yarn lint`**, **`yarn format:check`**, and **`yarn lint:type`**. The root script `yarn verify` runs `format:check`, `lint`, and `lint:type` together but does not run `yarn build`; use it only when you already built and need the same static checks in one command.
- Only skip agent mode when it is impossible or when you are debugging agent mode itself.
- If agent-mode output is missing or incomplete, debug that first rather than silently falling back to console-only review; use the checklist in `docs/allure-agent-mode.md` (**Agent mode failures and unavailable runs**).
- Use Allure agent-mode when adding tests for features or fixes so expectations, evidence quality, and scope review are part of the loop.
- Keep any non-testing project guidance here short; the detailed Allure workflow belongs in the linked guide.
