# Allure E2E Tests

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

## Overview

The package includes E2E tests for Allure packages.

## Run

Install the packages' dependencies:

```shell
yarn install
```

Don't forget to build all the packages which will be tested (run the command in the root directory):

```shell
yarn build
```

Run the tests:

```shell
yarn test
```

### Frontend–backend UI tests

The **frontend-backend** project runs Playwright tests against the real report-app and backend (API + Postgres). Infrastructure is started automatically in `globalSetup`:

- **Postgres** via [Testcontainers](https://testcontainers.com/) (requires Docker)
- **Backend** (Express) as a child process
- **Report-app** (Vite preview) built with `VITE_API_BASE_URL` pointing at the backend

Run only frontend-backend tests:

```shell
yarn test:frontend-backend
```

Or with the dedicated config:

```shell
npx playwright test -c playwright.frontend-backend.config.ts
```

Tests live in `test/frontend-backend/` and expect `env.json` (written by globalSetup) with `API_BASE_URL` and `FRONTEND_URL`. Do not run this project without the setup (e.g. plain `yarn test` runs only the static-report tests).
