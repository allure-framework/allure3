import WidgetStatusView from "@/components/widget-status/WidgetStatusView.js";

allure.api.addWidget(
  "widgets",
  "suites",
  WidgetStatusView.extend({
    rowTag: "a",
    title: "widget.suites.name",
    baseUrl: "suites",
    showLinks: true,
  }),
);
