import { getReportOptions } from "@allurereport/web-commons";
import { Text } from "@allurereport/web-components";
import { useEffect, useState } from "preact/hooks";
import type { AwesomeReportOptions } from "types";
import { currentLocaleIso } from "@/stores";
import * as styles from "./styles.scss";

export const FooterVersion = () => {
  const [createdAt, setCreatedAt] = useState<number | null>(null);

  useEffect(() => {
    const reportOptions = getReportOptions<AwesomeReportOptions>();
    if (reportOptions?.createdAt) {
      setCreatedAt(Number(reportOptions.createdAt));
    }
  }, []);

  const formattedCreatedAt = new Date(createdAt as number).toLocaleDateString(currentLocaleIso.value as string, {
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
