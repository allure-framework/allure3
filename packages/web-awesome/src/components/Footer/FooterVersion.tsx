import { getReportOptions } from "@allurereport/web-commons";
import { Text } from "@allurereport/web-components";
import type { AllureAwesomeReportOptions } from "types";
import { currentLocale } from "@/stores";
import * as styles from "./styles.scss";

export const FooterVersion = () => {
  const currentLang = currentLocale.value;
  const { createdAt } = getReportOptions<AllureAwesomeReportOptions>() ?? {};
  const locale = currentLang === "en" ? "en-US" : "ru-RU";

  const formattedCreatedAt = new Date(createdAt as number).toLocaleDateString(locale, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });

  return (
    <Text type="paragraph" size="m" className={styles.version}>
      {formattedCreatedAt}
      <span> Ver: 3.0.0</span>
    </Text>
  );
};
