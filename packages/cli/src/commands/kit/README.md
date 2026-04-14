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

## Quick Start

```bash
# 1) Initialize Allure in your project
npx allure kit init

# 2) Run tests so they produce allure-results
npm test

# 3) Build report
npx allure generate
```

If you want a fully non-interactive setup:

```bash
npx allure kit init --yes
```

## Commands

### `init`

```bash
allure kit init [--format json|yaml|mjs] [--yes] [--demo] [--cwd <path>]
```

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

