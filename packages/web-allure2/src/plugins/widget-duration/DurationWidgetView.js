import { View } from "backbone.marionette";
import DurationChartView from "@/components/graph-duration-chart/DurationChartView.js";
import { className, regions } from "@/decorators/index.js";
import template from "./DurationWidgetView.hbs";

@className("duration-widget")
@regions({
  chart: ".duration-widget__content",
})
class DurationWidgetView extends View {
  template = template;

  onRender() {
    this.showChildView(
      "chart",
      new DurationChartView({
        model: this.model.get("items"),
      }),
    );
  }
}

export default DurationWidgetView;
