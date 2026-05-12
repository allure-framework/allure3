# Allure Kit (`allure kit`)

`allure kit` is a set of CLI commands for bootstrapping and maintaining an Allure 3 setup in JavaScript/TypeScript projects.

It helps you:
- detect test frameworks and install matching Allure adapters,
- create and maintain `allurerc` config files,
- manage report plugins,
- diagnose setup issues.

Detected frameworks include popular runners like Vitest, Playwright, Jest, Mocha, Cypress, Cucumber.js, Jasmine, CodeceptJS, Newman, and WebdriverIO (WDIO).

## Run

Use without global install:

```bash
npx allure kit --help
```

Run a specific command:

```bash
npx allure kit init
```

`kit init` is also exposed as a top-level `allure init` alias:

```bash
npx allure init
```

## Quick Start

```bash
# 1) Initialize Allure in your project
npx allure init

# 2) Run tests so they produce allure-results
npm test

# 3) Build report
npx allure generate
```

If Allure is already configured (an `allurerc` file exists in the working directory), `init` exits early without changing anything and points you at `allure kit doctor` / `allure kit update`.

If you want a fully non-interactive setup:

```bash
npx allure init --yes
```

For a one-shot install of a specific framework:

```bash
npx allure init --lang=js --framework=playwright
```

## Commands

### `init`

```bash
allure init [--lang js|ts] [--framework <id>] [--format json|yaml|mjs] [--yes] [--cwd <path>]
# equivalent to:
allure kit init ...
```

Flags:

- `--lang` — project language. Currently `js` and `ts` are supported (treated the same).
- `--framework` — force-pick a single framework by id or package name (`playwright`, `vitest`, `wdio`, ...). Implies non-interactive mode.
- `--format` — `json` (default), `yaml`, or `mjs` config format.
- `--yes` — accept defaults without prompts.
- `--cwd` — working directory.

### `update`

```bash
allure kit update [--yes] [--cwd <path>]
```

### `doctor`

```bash
allure kit doctor [--cwd <path>]
```

### `gh-pages init`

Creates a GitHub Actions workflow that generates an Allure report and publishes it to GitHub Pages via the `gh-pages` branch.

```bash
allure kit gh-pages init [--yes] [--branch <name>] [--config <path>] [--test-command <cmd>] [--cwd <path>]
```

### `plugin list`

```bash
allure kit plugin list [--cwd <path>]
```

### `plugin add`

```bash
allure kit plugin add <name> [--skip-options] [--cwd <path>]
```

### `plugin remove`

```bash
allure kit plugin remove <name> [--uninstall] [--cwd <path>]
```

