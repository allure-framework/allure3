import { View } from "backbone.marionette";
import $ from "jquery";
import { className, on } from "@/decorators/index.js";
import router from "@/router.js";
import template from "./RetriesView.hbs";
import "./styles.scss";

@className("test-result-retries")
class RetriesView extends View {
  template = template;

  serializeData() {
    const extra = this.model.get("extra");
    const retries = extra ? extra.retries : null;
    return {
      cls: this.className,
      retries: retries,
    };
  }

  @on("click .retry-row")
  onRetryClick(e) {
    const uid = $(e.currentTarget).data("uid");
    router.toUrl(`#testresult/${uid}`);
  }
}

export default RetriesView;
