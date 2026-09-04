export default {
  name: "Resolution UI Demo",
  historyPath: "./output/resolution-ui-demo/history.jsonl",
  resolutions: {
    knownIssuesPath: "./output/resolution-ui-demo/known-issues.json",
    links: {
      jira: {
        urlTemplate: "https://example.test/browse/%s",
        nameTemplate: "%s"
      }
    },
    rules: [
      { resolution: "issue", messageRegexp: "BUG-101", issue: { id: "BUG-101", type: "jira" }, comment: "Checkout discount is not applied" },
      { resolution: "issue", messageRegexp: "BUG-102", issue: { id: "BUG-102", type: "jira" }, comment: "PayPal authorization timeout" },
      { resolution: "issue", messageRegexp: "BUG-103", issue: { id: "BUG-103", type: "jira" }, comment: "Refund processing leaves stale balance" },
      { resolution: "issue", messageRegexp: "BUG-104", issue: { id: "BUG-104", type: "jira" }, comment: "Search index is stale" },
      { resolution: "muted", messageRegexp: "MUTE-CDN", comment: "Muted external dependency" },
      { resolution: "accepted", messageRegexp: "ACCEPT-LEGACY", comment: "Accepted legacy behavior risk" }
    ]
  },
  plugins: {
    awesome: {
      options: {
        reportName: "Resolution UI Demo",
        open: false,
        reportLanguage: "en",
        groupBy: ["parentSuite", "suite", "story"],
        publish: true
      }
    }
  }
};
