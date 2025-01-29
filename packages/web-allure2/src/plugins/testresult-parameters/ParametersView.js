import { View } from "backbone.marionette";
import { className, on } from "@/decorators/index.js";
import template from "./ParametersView.hbs";
import "./styles.scss";

@className("pane__section")
class ParametersView extends View {
  template = template;

  serializeData() {
    return {
      parameters: this.model.get("parameters"),
    };
  }

  @on("click .environment")
  onParameterClick() {
    this.$(".environment").toggleClass("line-ellipsis", false);
  }
}

export default ParametersView;
