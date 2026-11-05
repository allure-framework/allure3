# Links to test results

HTML reports accept a common external link:

```text
<report>/index.html#testresult/<id>
```

Use the result's `TestResult.id`, also exposed in the generated `test-results.json`
registry. Each retry has its own result ID. Suite IDs, `historyId`, and `retryHash`
do not identify a particular result.

Awesome, Allure2, and Classic open the requested result. A missing result keeps
that report's existing error state. Dashboard and the report overview page have
no result details: they remove the result fragment and show their own root,
preserving the document path and query parameters.

A trailing slash is accepted. The legacy `#<id>` form (a 32-character hexadecimal
result ID) is also supported. Existing section and nested tree links continue to
work; section paths and result tabs remain specific to each report.

The common external link is an accepted entry point, not a required format for
every internal URL. Awesome preserves the explicit `#testresult/<id>` form when
switching result tabs, while some internal links use the legacy `#<id>` form.
Both forms open the same result. Classic and Allure2 normalize short legacy
links to `#testresult/<id>` without adding a browser history entry.

This contract applies to newly generated reports. Previously published HTML is
unchanged. History links keep the legacy form so they can still open older
Awesome reports.
