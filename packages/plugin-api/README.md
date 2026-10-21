# Plugin API

> Collection of interfaces for Allure plugins

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

## Overview

The interfaces in the package describe the entities used for building Allure Plugins.

## Internal report utilities

The `@allurereport/plugin-api/internal/report` subpath is reserved for Allure's bundled report generators and frontends. It is not part of the supported plugin API and may change without a major version bump. Third-party plugins should use the documented API entry points.

## Install

Use your favorite package manager to install the package:

```shell
npm add @allurereport/plugin-api
yarn add @allurereport/plugin-api
pnpm add @allurereport/plugin-api
```
