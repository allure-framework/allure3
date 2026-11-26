# Allure TestOps Plugin

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

This package preserves the default plugin export and the `TestOpsUploaderPluginOptions` type for projects that import `@allurereport/plugin-testops` directly. Existing `plugins.testops` entries and aliases continue to work.

## Configure

To migrate an existing entry, move its `options` fields into the top-level `testops` block. If the plugin entry sets `enabled`, move that value alongside the options. The top-level block takes precedence over legacy entries, so you can migrate without uploading a run twice.

See the [top-level configuration example and option reference](../core/README.md#allure-testops-launch-uploads).
