const fs = require("node:fs");

const MARKER = "<!-- allure-perf-metrics -->";
const SUMMARY_PATH = "./allure-perf-metrics/allure-perf-metrics.md";

module.exports = async ({ context, github }) => {
  const { owner, repo } = context.repo;
  const artifactsUrl = `${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`;
  const summary = fs.existsSync(SUMMARY_PATH)
    ? fs.readFileSync(SUMMARY_PATH, "utf8")
    : "### Allure perf metrics\n\nMetrics file was not generated.\n";
  const body = `${MARKER}\n${summary}\nArtifacts: [allure-perf-metrics](${artifactsUrl})`;
  const issue_number = context.payload.pull_request.number;
  const comments = await github.rest.issues.listComments({ owner, repo, issue_number, per_page: 100 });
  const previous = comments.data.find((comment) => comment.user.type === "Bot" && comment.body?.includes(MARKER));

  if (previous) {
    await github.rest.issues.updateComment({ owner, repo, comment_id: previous.id, body });
  } else {
    await github.rest.issues.createComment({ owner, repo, issue_number, body });
  }
};
