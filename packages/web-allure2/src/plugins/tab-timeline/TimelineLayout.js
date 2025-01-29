import TreeCollection from "@/data/tree/TreeCollection.js";
import AppLayout from "@/layouts/application/AppLayout.js";
import TimelineView from "./TimelineView.js";

export default class TimelineLayout extends AppLayout {
  initialize({ url }) {
    super.initialize();
    this.items = new TreeCollection([], { url, parse: true });
  }

  loadData() {
    return this.items.fetch();
  }

  getContentView() {
    return new TimelineView({ collection: this.items });
  }
}
