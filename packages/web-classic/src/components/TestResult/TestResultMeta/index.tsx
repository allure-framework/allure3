import { parseOwnerAddress } from "@allurereport/web-commons";
import { Tag, Text } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import type { ReportTestResult } from "types";

import { useI18n } from "@/stores/locale";

import * as styles from "./styles.scss";

const Owner: FunctionalComponent<{ value: string }> = ({ value }) => {
  const address = parseOwnerAddress(value);
  const displayName = address.displayName || value;

  if (address.type === "url") {
    return (
      <Text
        tag={"a"}
        size={"m"}
        href={address.url}
        target={"_blank"}
        rel={"noopener noreferrer"}
        className={styles["test-result-meta-link"]}
      >
        {displayName}
      </Text>
    );
  }

  if (address.type === "email") {
    return (
      <Text tag={"a"} size={"m"} href={`mailto:${address.email}`} className={styles["test-result-meta-link"]}>
        {displayName}
      </Text>
    );
  }

  return <Text size={"m"}>{displayName}</Text>;
};

const MetaRow: FunctionalComponent<{ title: string; testId: string }> = ({ title, testId, children }) => (
  <div className={styles["test-result-meta-row"]} data-testid={testId}>
    <Text size={"m"} bold className={styles["test-result-meta-title"]}>
      {title}:
    </Text>
    <div className={styles["test-result-meta-values"]}>{children}</div>
  </div>
);

export type TestResultMetaProps = {
  testResult?: ReportTestResult;
};

/**
 * Allure 2 like summary of the test result: categories, tags and owners.
 */
export const TestResultMeta: FunctionalComponent<TestResultMetaProps> = ({ testResult }) => {
  const { t } = useI18n("ui");
  const labels = testResult?.labels ?? [];
  const categories = (testResult?.categories ?? []).map(({ name }) => name).filter(Boolean);
  const tags = labels.filter(({ name, value }) => name === "tag" && value).map(({ value }) => value as string);
  const owners = labels.filter(({ name, value }) => name === "owner" && value).map(({ value }) => value as string);

  if (!categories.length && !tags.length && !owners.length) {
    return null;
  }

  return (
    <div className={styles["test-result-meta"]} data-testid="test-result-meta">
      {Boolean(categories.length) && (
        <MetaRow title={t("categories")} testId="test-result-meta-categories">
          <Text size={"m"}>{categories.join(", ")}</Text>
        </MetaRow>
      )}
      {Boolean(tags.length) && (
        <MetaRow title={t("tags")} testId="test-result-meta-tags">
          {tags.map((tag, key) => (
            <Tag key={key} skin={"neutral"}>
              {tag}
            </Tag>
          ))}
        </MetaRow>
      )}
      {Boolean(owners.length) && (
        <MetaRow title={t("owner")} testId="test-result-meta-owner">
          {owners.map((owner, key) => (
            <Owner key={key} value={owner} />
          ))}
        </MetaRow>
      )}
    </div>
  );
};
