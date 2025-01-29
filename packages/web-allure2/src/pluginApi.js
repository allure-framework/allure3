/* eslint-disable */
import TrendChartView from "./components/graph-trend-chart/TrendChartView.js";
import WidgetStatusView from "./components/widget-status/WidgetStatusView.js";
import TrendCollection from "./data/trend/TrendCollection.js";
import AppLayout from "./layouts/application/AppLayout.js";
import TreeLayout from "./layouts/tree/TreeLayout.js";
import pluginsRegistry from "./utils/pluginsRegistry.js";
import settings from "./utils/settings.js";
import { getSettingsForPlugin } from "./utils/settingsFactory.js";

window.allure = {
  api: pluginsRegistry,
  getPluginSettings(name, defaults) {
    return getSettingsForPlugin(name, defaults);
  },
  settings: settings,
  components: {
    AppLayout: AppLayout,
    TreeLayout: TreeLayout,
    WidgetStatusView: WidgetStatusView,
    TrendChartView: TrendChartView,
  },
  collections: {
    TrendCollection: TrendCollection,
  },
};
