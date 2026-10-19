# Allure 2 Web

Internal source and build configuration for the Allure 2-compatible report UI.
Its production assets are archived into `@allurereport/plugin-allure2`; this
workspace is not published or installed by CLI users.

The web sources are ported from the official
[Allure 2.46.0 release](https://github.com/allure-framework/allure2/releases/tag/2.46.0). The package builds them with Vite into `dist/multi` for the plugin build to pack.

## Build

```shell
yarn workspace @allurereport/web-allure2 build
```

## Development

```shell
yarn workspace @allurereport/web-allure2 dev
```

The development command builds the web package, generates a report from the
sandbox results, and serves the report with the local Vite source entry.

## Playwright suite

The browser suite and its result fixtures are ported from Allure 2.46.0. It
generates both directory and single-file reports through this repository's
`plugin-allure2`, then exercises them in Chromium with screenshots, video on
failure, and Playwright traces.

Install Chromium once, then run the suite:

```shell
yarn workspace @allurereport/web-allure2 test:e2e:install
yarn workspace @allurereport/web-allure2 test
```

For focused accessibility work, use:

```shell
yarn workspace @allurereport/web-allure2 test:e2e:accessibility
```
