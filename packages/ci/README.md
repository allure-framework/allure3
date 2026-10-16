# Allure CI Detector

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

## Publication outcomes in report summaries

`createReportContext(reportDir)` reads the optional root `publication.json` written by Allure 3.
It describes enabled plugins with `options.publish: true` in the current CLI run, including
plugins that could not generate a report. `createReportContextFromData` accepts the same array
as `publication`. These outcomes are separate from test statistics and quality gates.

```json
[
  { "pluginId": "awesome", "status": "published" },
  { "pluginId": "dashboard", "status": "not-published", "reason": "generation-failed" }
]
```

An unpublished entry has one of these reasons, in priority order:

- `generation-failed`: the plugin failed during `start` or `done`.
- `no-report-files`: no files other than the automatic root plugin summary were generated.
- `publisher-unavailable`: no publication client was created; check the service access token.
- `publication-failed`: the remote publication operation did not complete successfully.

The remote batch is confirmed only after completion. If uploading or completing the batch fails,
all reports in that batch are marked unpublished even if some files were already uploaded.
A successful publication does not require a returned report link.

`renderReportSummaryMarkdown(context)` includes an **Expected reports were not published**
warning after the statistics table when needed, including when no plugin summary exists.
Older reports without the file retain the existing Markdown output. Malformed files are ignored
with a diagnostic through `onError`.

The manifest is local only and is overwritten on every ordinary generation, including with an
empty array when no reports request publication. Dump-only and realtime runs do not write it.
Publication warnings do not change the run's exit code or test status. CI integrations that collect
summary files themselves must also pass `publication.json` to display these warnings; support in
external integrations such as `allure-action` requires a separate update.
