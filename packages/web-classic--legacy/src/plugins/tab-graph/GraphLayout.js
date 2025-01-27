import WidgetsGridView from "@/components/widgets-grid/WidgetsGridView.js";
import AppLayout from "@/layouts/application/AppLayout.js";
import GraphCollection from "./GraphCollection.js";

export default class GraphLayout extends AppLayout {
  initialize() {
    this.collection = new GraphCollection();
  }

  loadData() {
    return this.collection.fetch();
  }

  getContentView() {
    return new WidgetsGridView({ model: this.collection, tabName: "graph" });
  }
}
