import ErrorSplashView from "@/components/error-splash/ErrorSplashView.js";
import AppLayout from "@/layouts/application/AppLayout.js";

class ErrorLayout extends AppLayout {
  getContentView() {
    const { code, message } = this.options;
    return new ErrorSplashView({ code, message });
  }
}

export { ErrorLayout };
