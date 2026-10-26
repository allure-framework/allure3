import { sanitizeExternalUrl } from "@allurereport/core-api";
import { Button, SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { ReportTestResult } from "types";

import { MetadataButton } from "@/components/MetadataButton";
import { useI18n } from "@/stores/locale";

import * as styles from "./styles.scss";

export const VISIBLE_LINKS_LIMIT = 8;

interface TestResultLinkProps {
  name: string;
  url: string;
  type: string;
}

const linksIconMap: Record<string, string> = {
  issue: allureIcons.lineDevBug2,
  link: allureIcons.lineGeneralLink1,
  tms: allureIcons.lineGeneralChecklist3,
  github: allureIcons.github,
};

const TestResultLink: FunctionalComponent<{
  link: TestResultLinkProps;
}> = ({ link }) => {
  const { url, name, type } = link;
  const safeUrl = sanitizeExternalUrl(url);
  const label = name || url;

  return (
    <div className={styles["test-result-link"]} data-testid="test-result-link">
      <SvgIcon id={linksIconMap[type] ?? allureIcons.lineGeneralLink1} />
      {safeUrl ? (
        <Text
          tag={"a"}
          href={safeUrl}
          target={"_blank"}
          rel={"noopener noreferrer"}
          size={"m"}
          className={styles["test-result-link-text"]}
        >
          {label}
        </Text>
      ) : (
        <Text size={"m"} className={styles["test-result-link-text"]}>
          {label}
        </Text>
      )}
    </div>
  );
};

export type TestResultLinksProps = {
  links: ReportTestResult["links"];
};

export const TestResultLinks: FunctionalComponent<TestResultLinksProps> = ({ links }) => {
  const [isOpened, setIsOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const { t } = useI18n("ui");
  const hasMore = links.length > VISIBLE_LINKS_LIMIT;
  const visibleLinks = hasMore && !showAll ? links.slice(0, VISIBLE_LINKS_LIMIT) : links;
  const linkMap = visibleLinks.map((link, index) => {
    return <TestResultLink link={link as TestResultLinkProps} key={index} />;
  });

  return (
    <div className={styles["test-result-links"]}>
      <div className={styles["test-result-links-wrapper"]}>
        <MetadataButton isOpened={isOpened} setIsOpen={setIsOpen} counter={links.length} title={t("links")} />
        {isOpened && (
          <>
            <div className={styles["test-result-links-list"]}>{linkMap}</div>
            {hasMore && (
              <Button
                style="ghost"
                size="s"
                text={showAll ? t("showLess") : t("showMore")}
                onClick={() => setShowAll(!showAll)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};
