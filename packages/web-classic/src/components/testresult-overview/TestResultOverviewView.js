import { View } from "backbone.marionette";
import TestResultExecutionView from "@/components/testresult-execution/TestResultExecutionView.js";
import { className, regions } from "@/decorators/index.js";
import pluginsRegistry from "@/utils/pluginsRegistry.js";
import template from "./TestResultOverviewView.hbs";
import "./styles.scss";

@className("test-result-overview")
@regions({
  execution: ".test-result-overview__execution",
})
class TestResultOverviewView extends View {
  template = template;

  initialize() {
    this.blocks = [];
  }

  onRender() {
    this.showBlock(this.$(".test-result-overview__tags"), pluginsRegistry.testResultBlocks.tag);
    this.showBlock(this.$(".test-result-overview__before"), pluginsRegistry.testResultBlocks.before);
    this.showChildView("execution", new TestResultExecutionView(this.options));
    this.showBlock(this.$(".test-result-overview__after"), pluginsRegistry.testResultBlocks.after);
  }

  onDestroy() {
    this.blocks.forEach((block) => block.destroy());
  }

  showBlock(container, blocks) {
    blocks.forEach((Block) => {
      const block = new Block({ model: this.model });
      block.$el.appendTo(container);
      this.blocks.push(block);
      block.render();
    });
  }

  templateContext() {
    return {
      cls: this.className,
    };
  }
}

export default TestResultOverviewView;
