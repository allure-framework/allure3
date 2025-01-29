import TrendCollection from "@/data/trend/TrendCollection.js";
import HistoryTrendWidgetView from "./HistoryTrendWidgetView.js";

allure.api.addWidget("widgets", "history-trend", HistoryTrendWidgetView, TrendCollection);

allure.api.addWidget("graph", "history-trend", HistoryTrendWidgetView, TrendCollection);
