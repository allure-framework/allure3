import { View } from "backbone.marionette";
import { className } from "@/decorators/index.js";
import template from "./LinksView.hbs";
import "./styles.scss";

@className("pane__section")
class LinksView extends View {
  template = template;

  serializeData() {
    return {
      links: this.model.get("links"),
    };
  }
}

export default LinksView;
