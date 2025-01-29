import GraphLayout from "./GraphLayout.js";

allure.api.addTab("graph", {
  title: "tab.graph.name",
  icon: "graphs",
  route: "graph",
  onEnter: () => new GraphLayout(),
});
