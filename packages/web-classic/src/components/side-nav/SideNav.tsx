import { SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import clsx from "clsx";
import { h } from "preact";
import { LanguagePicker } from "@/components/LanguagePicker";
import { useI18n } from "@/stores";
import { activeTab } from "@/stores/router";
import { navigateTo } from "@/utils/navigate";
import * as styles from "./styles.scss";

const tabs = [
  { tabName: "overview", title: "Overview", icon: "lineGeneralHomeLine", active: true },
  { tabName: "categories", title: "Categories", icon: "flag", active: false },
  { tabName: "suites", title: "Suites", icon: "lineFilesFolder", active: false },
  { tabName: "graphs", title: "Graphs", icon: "bar-chart", active: false },
  { tabName: "timeline", title: "Timeline", icon: "clock", active: false },
  { tabName: "behaviors", title: "Behaviors", icon: "list", active: false },
  { tabName: "packages", title: "Packages", icon: "lineDevDataflow3", active: false },
];
const SideNav = () => {
  const { t } = useI18n("translation");

  return (
    <div class={styles["side-nav"]}>
      <a href="#" className={styles.brand} data-ga4-event="home_click">
        <SvgIcon id={allureIcons.reportLogo} size={"s"} />
        <Text className={styles["brand-text"]} bold>
          Allure
        </Text>
      </a>
      <ul className={styles.menu}>
        {tabs?.map((tab) => (
          <li
            className={styles.item}
            data-tooltip={tab.title}
            data-ga4-event="tab_click"
            data-ga4-param-tab={tab.tabName}
            key={tab.tabName}
          >
            <a
              href={`#${tab.tabName}`}
              className={clsx(styles.link, { [styles["link-active"]]: activeTab.value === tab.tabName })}
              onClick={() => navigateTo(tab.tabName)}
            >
              <span className={styles.icon}>
                <SvgIcon id={allureIcons[tab.icon]} />
              </span>
              <Text className={styles.text}>{t(tab.title)}</Text>
            </a>
          </li>
        ))}
      </ul>
      <div className={styles.strut} />
      <div className={styles.footer}>
        <div className={styles["language-picker"]} data-tooltip="Language">
          <LanguagePicker />
        </div>
        <div className={styles.item} data-tooltip="Expand" data-ga4-event="expand_menu_click">
          <div className={styles.collapse}>
            <span className={styles.icon}>
              <SvgIcon id={allureIcons.lineArrowsChevronDown} />
            </span>
            <Text className={styles.text}>Collapse</Text>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SideNav;
