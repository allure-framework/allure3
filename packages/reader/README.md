# Reader

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

## Overview

Set of Allure Reader implementations which allow to read different files formats as Allure Results files.

### Open Test Reporting

The `openTestReporting` reader supports the event-based and hierarchical XML formats from
[Open Test Reporting](https://github.com/ota4j-team/open-test-reporting), using schema version **0.2.0** only.
It is included among Allure's default readers, so no additional configuration is required.

Reports are recognized by their XML namespaces, regardless of the producer, namespace prefixes, or `.xml` filename.
Ancestor names provide suite grouping. When JUnit's optional type metadata is present, `TEST` and
`CONTAINER_AND_TEST` nodes become test results, while `CONTAINER` nodes provide structure only. Test/container
nodes also retain their child tests. Missing or unknown types use leaf-node inference, so other producers do not
need JUnit metadata. Failed containers are reported as global errors, preserving their reasons and Java traces.
The reader imports statuses, timing, reasons, tags, source information, infrastructure metadata, and the standard
Java source and throwable extensions when present. Other unknown extensions are ignored.

Core data and output attachments are preserved as JSON and text. File attachments are resolved relative to the
report file's directory; absolute paths are accepted only within that directory. Symbolic links and paths outside
the report directory are rejected. Missing or unsafe attachments produce a warning without preventing test import.
Local file attachments require a filesystem-backed report, not an in-memory XML buffer.

## Install

Use your favorite package manager to install the package:

```shell
npm add @allurereport/reader
yarn add @allurereport/reader
pnpm add @allurereport/reader
```
