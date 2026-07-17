# Contributing

## Development

Install dependencies and build the project packages:

```bash
yarn install
yarn build
```

You can use `@allurereport/sandbox` as a playground for development. See `packages/sandbox/README.md` for details.

## Report UI Development

Run a report UI package with generated demo data:

```bash
yarn workspace @allurereport/web-awesome dev
yarn workspace @allurereport/web-classic dev
yarn workspace @allurereport/web-dashboard dev
```

By default, demo reports are generated from `packages/sandbox/allure-results`.

Use a custom Allure results directory with:

```bash
ALLURE_RESULTS_DIR=/absolute/path/to/allure-results yarn workspace <report-package> dev
```

The `dev` command runs three internal phases:

- `dev:demo`: generate demo report data
- `dev:copy`: move generated data into the dev-server location
- `dev:serve`: start the local dev server
