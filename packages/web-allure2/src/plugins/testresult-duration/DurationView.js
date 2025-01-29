import { View } from "backbone.marionette";
import { className } from "@/decorators/index.js";
import template from "./DurationView.hbs";

@className("pane__section")
class DurationView extends View {
  template = template;

  serializeData() {
    return {
      time: this.model.get("time"),
    };
  }
}

export default DurationView;
