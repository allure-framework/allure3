import { ensureReportDataReady } from "@allurereport/web-commons";
import "highlight.js/styles/github-gist.css";
import $ from "jquery";
import "normalize-css/normalize.css";
import { App } from "./app.js";
import "./blocks/arrow/styles.scss";
import "./blocks/executor-icon/styles.scss";
import "./blocks/pane/styles.scss";
import "./blocks/status-details/styles.scss";
import "./blocks/table/styles.scss";
import "./blocks/tabs/styles.scss";
import "./favicon.ico";
import "./pluginApi.js";
import "./plugins/default/index.js";
import "./plugins/screen-diff/index.js";
import "./plugins/screen-diff/styles.css";
import "./plugins/tab-behaviors/index.js";
import "./plugins/tab-category/index.js";
import "./plugins/tab-graph/index.js";
import "./plugins/tab-packages/index.js";
import "./plugins/tab-suites/index.js";
import "./plugins/tab-timeline/index.js";
import "./plugins/testresult-category/index.js";
import "./plugins/testresult-description/index.js";
import "./plugins/testresult-duration/index.js";
import "./plugins/testresult-history/index.js";
import "./plugins/testresult-links/index.js";
import "./plugins/testresult-owner/index.js";
import "./plugins/testresult-parameters/index.js";
import "./plugins/testresult-retries/index.js";
import "./plugins/testresult-severity/index.js";
import "./plugins/testresult-tags/index.js";
import "./plugins/widget-categories-trend/index.js";
import "./plugins/widget-categories/index.js";
import "./plugins/widget-duration-trend/index.js";
import "./plugins/widget-duration/index.js";
import "./plugins/widget-environment/index.js";
import "./plugins/widget-executor/index.js";
import "./plugins/widget-history-trend/index.js";
import "./plugins/widget-retry-trend/index.js";
import "./plugins/widget-severity/index.js";
import "./plugins/widget-status/index.js";
import "./plugins/widget-suites/index.js";
import "./plugins/widget-summary/index.js";

window.jQuery = $;

$(document).ready(async () => {
  await ensureReportDataReady();

  return App.start();
});
