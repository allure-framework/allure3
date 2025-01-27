import OverviewLayout from "@/layouts/overview/OverviewLayout.js";

allure.api.addTab("", {
  title: "tab.overview.name",
  icon: "overview",
  route: "",
  onEnter: () =>
    new OverviewLayout({
      tabName: "tab.overview.name",
    }),
});
