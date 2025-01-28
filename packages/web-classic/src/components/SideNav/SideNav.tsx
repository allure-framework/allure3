import { SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import clsx from "clsx";
import { h } from "preact";
import { useState } from "preact/hooks";
import { LanguagePicker } from "@/components/LanguagePicker";
import { useI18n } from "@/stores";
import { activeTab } from "@/stores/router";
import { navigateTo } from "@/utils/navigate";
import * as styles from "./styles.scss";

const tabs = [
  { tabName: "overview", title: "Overview", icon: "lineGeneralHomeLine", active: false },
  { tabName: "behaviors", title: "Behaviors", icon: "lineFilesClipboardCheck", active: false },
  { tabName: "categories", title: "Categories", icon: "lineFilesFile2", active: false },
  { tabName: "graphs", title: "Graphs", icon: "lineChartsBarChartSquare", active: false },
  { tabName: "packages", title: "Packages", icon: "lineDevDataflow3", active: false },
  { tabName: "suites", title: "Suites", icon: "lineFilesFolder", active: false },
  { tabName: "timeline", title: "Timeline", icon: "lineTimeClockStopwatch", active: false },
];
const SideNav = () => {
  const { t: controls } = useI18n("controls");
  const { t: nav } = useI18n("nav");
  const [isCollapsed, setCollapsed] = useState(localStorage.getItem("sidebarCollapsed") === "true");

  const toggleCollapsed = () => {
    localStorage.setItem("sidebarCollapsed", String(!isCollapsed));
    setCollapsed(!isCollapsed);
  };

  return (
    <div class={clsx(styles["side-nav"], isCollapsed && styles.collapsed)}>
      <a href="#" className={styles.brand} data-ga4-event="home_click">
        <SvgIcon id={allureIcons.reportLogo} size={"s"} className={styles.icon} />
        <Text className={styles["brand-text"]} bold>
          Allure Report
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
              <Text className={styles.text}>{nav(tab.tabName)}</Text>
            </a>
          </li>
        ))}
      </ul>
      <div className={styles.strut} />
      <div className={styles.footer}>
        <div className={styles["language-picker"]} data-tooltip="Language">
          <LanguagePicker />
        </div>
        <div className={styles.item} data-tooltip="Expand" data-ga4-event="expand_menu_click" onClick={toggleCollapsed}>
          <div className={styles.collapse}>
            <span className={styles["collapse-icon"]}>
              <SvgIcon id={allureIcons.lineArrowsChevronDown} />
            </span>
            <Text className={styles.text}>{controls("collapse")}</Text>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SideNav;
