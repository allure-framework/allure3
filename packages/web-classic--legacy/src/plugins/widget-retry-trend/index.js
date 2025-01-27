import TrendCollection from "@/data/trend/TrendCollection.js";
import RetryTrendWidgetView from "./RetryTrendWidgetView.js";

allure.api.addWidget("graph", "retry-trend", RetryTrendWidgetView, TrendCollection);
