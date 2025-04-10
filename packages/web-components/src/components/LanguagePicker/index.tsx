import { LANG_LOCALE, type LangLocale } from "@allurereport/web-commons";
import { DropdownButton } from "@/components/Button";
import { Menu } from "@/components/Menu";

export interface LanguagePickerProps {
  locale: LangLocale;
  setLocale: (locale: LangLocale) => void;
  availableLocales?: LangLocale[];
}

export const LanguagePicker = ({ locale, setLocale, availableLocales }: LanguagePickerProps) => {
  const handleSelect = (selectedOption: LangLocale) => {
    setLocale(selectedOption);
  };

  const locales = availableLocales ? availableLocales : (Object.keys(LANG_LOCALE) as LangLocale[]);
  const langPickerOptions = [...new Set(locales)].map((item) => ({
    key: item,
    value: LANG_LOCALE[item].full,
  }));

  return (
    <Menu
      size="s"
      menuTrigger={({ isOpened, onClick }) => (
        <DropdownButton
          style="ghost"
          size="s"
          text={(LANG_LOCALE[locale] && LANG_LOCALE[locale].short) || LANG_LOCALE.en.short}
          isExpanded={isOpened}
          onClick={onClick}
        />
      )}
    >
      <Menu.Section>
        {langPickerOptions.map(({ key, value }) => (
          <Menu.ItemWithCheckmark onClick={() => handleSelect(key)} key={key} isChecked={locale === key}>
            {value}
          </Menu.ItemWithCheckmark>
        ))}
      </Menu.Section>
    </Menu>
  );
};
