import { View } from "backbone.marionette";
import { scaleOrdinal } from "d3-scale";
import TrendChartView from "@/components/graph-trend-chart/TrendChartView.js";
import { className, regions } from "@/decorators/index.js";
import { values } from "@/utils/statuses.js";
import template from "./HistoryTrendWidgetView.hbs";
import "./styles.scss";

@regions({
  chart: ".history-trend__chart",
})
@className("history-trend")
class HistoryTrendWidgetView extends View {
  template = template;

  onRender() {
    this.showChildView(
      "chart",
      new TrendChartView({
        model: this.model,
        hideLines: true,
        hidePoints: true,
        colors: scaleOrdinal(["#fd5a3e", "#ffd050", "#97cc64", "#aaa", "#d35ebe"]).domain(values),
        keys: values,
      }),
    );
  }
}

export default HistoryTrendWidgetView;
