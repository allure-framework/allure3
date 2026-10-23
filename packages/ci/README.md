# Allure CI Detector

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

## Publication outcomes in report summaries

Plugin summaries have an optional `published` boolean. `true` means the requested publication
completed; `false` means publication was requested but did not complete. The field is omitted
when publication was not requested, including realtime runs. Dump-only runs generate no summaries.
Plugins without a summary are outside this publication status contract.

The remote batch is confirmed only after completion. If uploading or completing the batch fails,
all reports in that batch are marked unpublished even if some files were already uploaded.
A successful publication does not require a returned report link.

`createReportContext` reads the flag from `summary.json`; `createReportContextFromData` accepts it
in `summaries`. `renderReportSummaryMarkdown` includes an **Expected reports were not published**
warning after the statistics table for reports with `published: false`. Older summaries without
the field retain the existing output. Details remain in the CLI logs; publication warnings do not
change test statistics, quality gates, or the run's exit code.
