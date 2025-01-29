import { reportDataUrl } from "@allurereport/web-commons";
import { Collection } from "backbone";

export default class GraphCollection extends Collection {
  url = function () {
    return "widgets/status-chart.json";
  };

  fetch(options) {
    return reportDataUrl(this.url(), "application/json").then((value) => super.fetch({ ...options, url: value }));
  }
}
