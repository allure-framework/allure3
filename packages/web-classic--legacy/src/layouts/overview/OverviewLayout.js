import WidgetsGridView from "@/components/widgets-grid/WidgetsGridView.js";
import AppLayout from "@/layouts/application/AppLayout.js";

export default class OverviewLayout extends AppLayout {
  getContentView() {
    return new WidgetsGridView({ tabName: "widgets" });
  }
}
