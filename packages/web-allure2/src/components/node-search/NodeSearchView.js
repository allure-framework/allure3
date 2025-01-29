import { View } from "backbone.marionette";
import { className, on } from "@/decorators/index.js";
import gtag from "@/utils/gtag.js";
import template from "./NodeSearchView.hbs";
import "./styles.scss";

export const SEARCH_QUERY_KEY = "searchQuery";

@className("search")
class NodeSearchView extends View {
  template = template;

  initialize({ state }) {
    this.state = state;
  }

  onRender() {
    this.$("input").val(this.state.get(SEARCH_QUERY_KEY));
  }

  @on("input input")
  onChangeSorting(e) {
    this.state.set(SEARCH_QUERY_KEY, e.target.value);
    gtag("search");
  }

  close() {
    this.state.set(SEARCH_QUERY_KEY, "");
  }
}

export default NodeSearchView;
