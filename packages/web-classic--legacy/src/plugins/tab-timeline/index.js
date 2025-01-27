import TimelineLayout from "./TimelineLayout.js";

allure.api.addTab("timeline", {
  title: "tab.timeline.name",
  icon: "timeline",
  route: "timeline",
  onEnter: (...routeParams) =>
    new TimelineLayout({
      ...routeParams,
      url: "data/timeline.json",
    }),
});
