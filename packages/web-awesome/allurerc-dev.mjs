export default {
  name: "Allure Awesome Dev",
  resolutions: {
    knownIssuesPath: "./out/known-issues.json",
    links: {
      sample: {
        urlTemplate: "https://allurereport.org/tasks/%s",
        nameTemplate: "Sample issue %s",
      },
    },
    rules: [
      {
        resolution: "issue",
        messageRegexp: "test issue",
        issue: {
          id: "TEST-1",
          type: "sample",
        },
      },
      {
        resolution: "muted",
        messageRegexp: "test muted",
        comment: "The risk is zero, so we can mute the problem to prevent the report pollution",
      },
      {
        resolution: "accepted",
        messageRegexp: "test accepted",
        comment: "We accept the possible risks",
      },
    ],
  },
  plugins: {
    awesome: {
      options: {
        groupBy: ["epic", "feature", "story"],
      },
    },
  },
};
