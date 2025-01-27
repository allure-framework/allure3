import { View } from "backbone.marionette";
import ErrorSplashView from "@/components/error-splash/ErrorSplashView.js";
import SideNav from "@/components/side-nav/SideNavView.js";
import { behavior, className, regions } from "@/decorators/index.js";
import template from "./AppLayout.hbs";
import "./styles.scss";

@className("app")
@regions({
  content: ".app__content",
  nav: ".app__nav",
})
@behavior("GaBehavior")
@behavior("DownloadBehavior")
class AppLayout extends View {
  template = template;

  initialize() {}

  onRender() {
    this.showChildView("nav", new SideNav());
    const dataPromise = this.loadData();
    if (dataPromise) {
      dataPromise
        .then(() => {
          this.showChildView("content", this.getContentView());
          this.onViewReady();
        })
        .catch((e) => {
          this.showChildView("content", new ErrorSplashView({ code: 404, message: e }));
        });
    } else {
      this.showChildView("content", this.getContentView());
    }
  }

  onViewReady() {}

  loadData() {}

  getContentView() {
    throw new Error("attempt to call abstract method");
  }

  shouldKeepState() {
    return true;
  }
}

export default AppLayout;
