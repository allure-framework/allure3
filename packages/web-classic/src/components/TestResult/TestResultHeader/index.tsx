import { IconButton, SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import clsx from "clsx";
import type { FunctionalComponent } from "preact";
import type { AwesomeTestResult } from "types";
import { LanguagePicker } from "@/components/LanguagePicker";
import { ThemeButton } from "@/components/ThemeButton/ThemeButton";
import { navigateTo } from "@/index";
import * as styles from "./styles.scss";

export type TestResultHeaderProps = {
  testResult?: AwesomeTestResult;
};

export const TestResultHeader: FunctionalComponent<TestResultHeaderProps> = ({ testResult }) => {
  const { breadcrumbs, name } = testResult || {};

  return (
    <div className={styles.above}>
      <div className={styles["test-result-breadcrumbs"]}>
        <div className={clsx(styles["test-result-breadcrumb"], styles["test-result-home"])}>
          <IconButton
            icon={allureIcons.lineGeneralHomeLine}
            size={"s"}
            style={"ghost"}
            className={styles["test-result-breadcrumb-link"]}
            onClick={() => navigateTo("/")}
          />
        </div>
        {Boolean(breadcrumbs?.length) &&
          breadcrumbs?.[0]?.map((item, key) => {
            return (
              <div className={styles["test-result-breadcrumb"]} key={key}>
                <SvgIcon id={allureIcons.lineArrowsChevronDown} className={styles["test-result-breadcrumb-arrow"]} />
                <Text size={"s"} bold className={styles["test-result-breadcrumb-title"]}>
                  {item}
                </Text>
              </div>
            );
          })}
        <div className={styles["test-result-breadcrumb"]}>
          {name && (
            <SvgIcon id={allureIcons.lineArrowsChevronDown} className={styles["test-result-breadcrumb-arrow"]} />
          )}
          <Text size={"s"} bold className={styles["test-result-breadcrumb-title"]}>
            {name}
          </Text>
        </div>
      </div>
      <LanguagePicker />
      <ThemeButton />
    </div>
  );
};
