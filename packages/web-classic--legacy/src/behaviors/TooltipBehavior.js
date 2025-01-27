import { Behavior } from "backbone.marionette";
import { escapeExpression as escape } from "handlebars/runtime.js";
import TooltipView from "@/components/tooltip/TooltipView.js";
import { on } from "@/decorators/index.js";

export default class TooltipBehavior extends Behavior {
  initialize() {
    this.tooltip = new TooltipView(this.options);
  }

  onDestroy() {
    this.tooltip.hide();
  }

  @on("mouseenter [data-tooltip]")
  onTipHover(e) {
    const el = this.$(e.currentTarget);
    this.tooltip.show(escape(el.data("tooltip")), el);
  }

  @on("mouseleave [data-tooltip]")
  onTipLeave() {
    this.tooltip.hide();
  }
}
