import TrendCollection from "@/data/trend/TrendCollection.js";
import DurationTrendWidgetView from "./DurationTrendWidgetView.js";

allure.api.addWidget("graph", "duration-trend", DurationTrendWidgetView, TrendCollection);
