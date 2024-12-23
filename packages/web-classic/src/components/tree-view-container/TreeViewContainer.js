import { Model } from "backbone";
import { View } from "backbone.marionette";
import MarksToggleView from "@/components/marks-toggle/MarksToggleView.js";
import NodeSearchView from "@/components/node-search/NodeSearchView.js";
import NodeSorterView from "@/components/node-sorter/NodeSorterView.js";
import StatusToggleView from "@/components/status-toggle/StatusToggleView.js";
import TreeView from "@/components/tree/TreeView.js";
import { behavior, className, on, regions } from "@/decorators/index.js";
import gtag from "@/utils/gtag.js";
import { getSettingsForTreePlugin } from "@/utils/settingsFactory.js";
import template from "./TreeViewContainer.hbs";
import "./styles.scss";

@className("tree")
@behavior("TooltipBehavior", { position: "bottom" })
@regions({
  search: ".pane__search",
  sorter: ".tree__sorter",
  filter: ".tree__filter",
  filterMarks: ".tree__filter-marks",
  content: ".tree__content",
})
class TreeViewContainer extends View {
  template = template;

  initialize({
    routeState,
    state = new Model(),
    tabName,
    baseUrl,
    csvUrl = null,
    settings = getSettingsForTreePlugin(baseUrl),
  }) {
    this.state = state;
    this.routeState = routeState;
    this.baseUrl = baseUrl;
    this.csvUrl = csvUrl;
    this.tabName = tabName;
    this.listenTo(this.routeState, "change:testResultTab", this.render);
    this.settings = settings;
  }

  @on("click .tree__info")
  onInfoClick() {
    const show = this.settings.isShowGroupInfo();
    this.settings.setShowGroupInfo(!show);
    gtag("tree_info_click", { enable: !show });
  }

  onRender() {
    this.showChildView(
      "content",
      new TreeView({
        state: this.state,
        routeState: this.routeState,
        tabName: this.tabName,
        baseUrl: this.baseUrl,
        settings: this.settings,
        collection: this.collection,
      }),
    );

    this.showChildView(
      "search",
      new NodeSearchView({
        state: this.state,
      }),
    );
    this.showChildView(
      "sorter",
      new NodeSorterView({
        settings: this.settings,
      }),
    );
    this.showChildView(
      "filter",
      new StatusToggleView({
        settings: this.settings,
        statistic: this.collection.statistic,
      }),
    );
    this.showChildView(
      "filterMarks",
      new MarksToggleView({
        settings: this.settings,
      }),
    );
  }

  templateContext() {
    return {
      cls: this.className,
      showGroupInfo: this.settings.isShowGroupInfo(),
      tabName: this.tabName,
      shownCases: 0,
      totalCases: 0,
      filtered: false,
      csvUrl: this.csvUrl,
    };
  }
}

export default TreeViewContainer;
