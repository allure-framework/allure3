import "@allurereport/web-components/index.css";
import { render } from "preact";
import "@/assets/scss/index.scss";
import { fetchEnvTreesData } from "@/stores/tree";
import { isMac } from "@/utils/isMac";
import { App } from "./App";
import { migrateFilterParam } from "./stores/treeFilters/utils";

const rootElement = document.getElementById("app");

document.addEventListener("DOMContentLoaded", () => {
  if (isMac) {
    document.documentElement.setAttribute("data-os", "mac");
  }
});

migrateFilterParam();

render(<App />, rootElement);
