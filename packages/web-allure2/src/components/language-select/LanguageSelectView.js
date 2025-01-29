import $ from "jquery";
import PopoverView from "@/components/popover/PopoverView.js";
import { className, on } from "@/decorators/index.js";
import gtag from "@/utils/gtag.js";
import settings from "@/utils/settings.js";
import i18next, { LANGUAGES } from "@/utils/translation.js";
import template from "./LanguageSelectView.hbs";
import "./styles.scss";

@className("language-select popover")
class LanguageSelectView extends PopoverView {
  initialize() {
    super.initialize({ position: "top-right" });
  }

  setContent() {
    this.$el.html(
      template({
        languages: LANGUAGES,
        currentLang: settings.getLanguage(),
      }),
    );
  }

  show(anchor) {
    super.show(null, anchor);
    this.delegateEvents();
    setTimeout(() => {
      $(document).one("click", () => this.hide());
    });
  }

  @on("click .language-select__item")
  onLanguageClick(e) {
    const langId = this.$(e.currentTarget).data("id");
    settings.setLanguage(langId);
    i18next.changeLanguage(langId);
    gtag("language_change", { language: langId });
  }
}

export default LanguageSelectView;
