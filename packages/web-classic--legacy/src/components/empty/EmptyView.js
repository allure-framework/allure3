import { View } from "backbone.marionette";
import { className } from "@/decorators/index.js";
import template from "./EmptyView.hbs";
import "./styles.scss";

@className("empty-view")
class EmptyView extends View {
  template = template;

  serializeData() {
    return {
      cls: this.className,
      message: this.options.message,
    };
  }
}

export default EmptyView;
