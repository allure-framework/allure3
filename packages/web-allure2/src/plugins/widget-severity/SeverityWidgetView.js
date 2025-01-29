import { View } from "backbone.marionette";
import SeverityChartView from "@/components/graph-severity-chart/SeverityChartView.js";
import { className, regions } from "@/decorators/index.js";
import template from "./SeverityWidgetView.hbs";

@className("severity-widget")
@regions({
  chart: ".severity-widget__content",
})
class SeverityWidgetView extends View {
  template = template;

  onRender() {
    this.showChildView(
      "chart",
      new SeverityChartView({
        model: this.model.get("items"),
      }),
    );
  }
}

export default SeverityWidgetView;
