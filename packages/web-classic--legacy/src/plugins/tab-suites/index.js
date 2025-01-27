allure.api.addTab("suites", {
  title: "tab.suites.name",
  icon: "folder",
  route: "suites(/)(:testGroup)(/)(:testResult)(/)(:testResultTab)(/)",
  onEnter: (testGroup, testResult, testResultTab) =>
    new allure.components.TreeLayout({
      testGroup,
      testResult,
      testResultTab,
      tabName: "tab.suites.name",
      baseUrl: "suites",
      url: "data/suites.json",
      csvUrl: "data/suites.csv",
    }),
});
