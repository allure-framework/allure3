import TrendCollection from "@/data/trend/TrendCollection.js";
import CategoriesTrendWidgetView from "./CategoriesTrendWidgetView.js";

allure.api.addWidget("graph", "categories-trend", CategoriesTrendWidgetView, TrendCollection);
