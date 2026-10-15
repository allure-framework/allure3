# Static Server

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

## Overview

Minimalistic web-server for serving Allure Reports and static files with live reload support.

## Install

Use your favorite package manager to install the package:

```shell
npm add @allurereport/static-server
yarn add @allurereport/static-server
pnpm add @allurereport/static-server
```

## Usage

The server can be used programmatically only:

```javascript
import { serve } from "@allurereport/static-server";

const server = await serve({
  // by default uses a random available port
  port: 8080,
  // by default listens on all interfaces
  host: "127.0.0.1",
  // path to the directory with files should be served
  servePath: "/path/to/your/static/files",
  // enable live reload
  live: true,
});

// reloads the served pages manually, even if live reload isn't enabled
await server.reload();
// stops the server
await server.stop();
```
