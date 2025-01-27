import { View } from "backbone.marionette";
import { options } from "@/decorators/index.js";
import template from "./LoaderView.hbs";
import "./styles.scss";

@options({
  text: "Loading...",
})
class LoaderView extends View {
  template = template;

  initialize(opts) {
    this.options = opts;
  }

  serializeData() {
    return this.options;
  }
}

export default LoaderView;
