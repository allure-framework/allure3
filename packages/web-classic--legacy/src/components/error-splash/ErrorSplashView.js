import { View } from "backbone.marionette";
import { className } from "@/decorators/index.js";
import template from "./ErrorSplashView.hbs";
import "./styles.scss";

@className("error-splash")
class ErrorSplashView extends View {
  template = template;

  serializeData() {
    return {
      cls: this.className,
      code: this.options.code,
      message: this.options.message,
    };
  }
}

export default ErrorSplashView;
