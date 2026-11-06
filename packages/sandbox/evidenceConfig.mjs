export const sandboxQualityGate = {
  rules: [
    {
      maxFailures: 5,
      fastFail: true,
    },
    {
      // Fails: not all tests have env "foo" (some have "bar" or "default")
      allTestsContainEnv: "foo",
    },
    {
      // Fails: "staging" is not present in the run (only foo, bar, default exist)
      environmentsTested: ["foo", "bar", "staging"],
    },
  ],
};

export const sandboxPerformance = {
  groups: {
    data: {
      title: "Result data",
    },
    report: {
      title: "Report generation",
    },
    attachments: {
      title: "Attachment demos",
    },
  },
  metrics: {
    "sandbox.results.load": {
      title: "Load sandbox results",
      unit: "ms",
      better: "lower",
      group: "data",
    },
    "sandbox.report.awesome": {
      title: "Generate Awesome report",
      unit: "ms",
      better: "lower",
      group: "report",
    },
    "sandbox.attachments.httpExchange": {
      title: "Render HTTP exchange attachments",
      unit: "ms",
      better: "lower",
      group: "attachments",
    },
  },
};
