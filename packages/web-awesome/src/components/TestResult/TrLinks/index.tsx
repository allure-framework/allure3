import { sanitizeExternalUrl } from "@allurereport/core-api";
import { Button, SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";

import { MetadataButton } from "@/components/MetadataButton";
import { useI18n } from "@/stores/locale";
import { collapsedTrees, toggleTree } from "@/stores/tree";

import { AwesomeTestResult } from "../../../../types";

import * as styles from "./styles.scss";

const VISIBLE_LINKS_LIMIT = 8;

interface TrLinkProps {
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

const TrLink: FunctionalComponent<{
  link: TrLinkProps;
}> = ({ link }) => {
  const { url, name, type } = link;
  const safeUrl = sanitizeExternalUrl(url);
  const label = name || url;

  return (
    <div className={styles["test-result-link"]} data-testid="test-result-meta-link">
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

export type TrLinksProps = {
  id?: string;
  links: AwesomeTestResult["links"];
};

export const TrLinks: FunctionalComponent<TrLinksProps> = ({ id, links }) => {
  const { t } = useI18n("ui");
  const linksId = id !== null ? `${id}-links` : null;
  const linksShowAllId = id !== null ? `${id}-links-showAll` : null;
  const isOpened = !collapsedTrees.value.has(linksId);
  const showAll = collapsedTrees.value.has(linksShowAllId);
  const visibleLinks =
    links.length <= VISIBLE_LINKS_LIMIT ? links : showAll ? links : links.slice(0, VISIBLE_LINKS_LIMIT);
  const linkMap = visibleLinks.map((link, index) => {
    return <TrLink link={link as TrLinkProps} key={index} />;
  });

  return (
    <div className={styles["test-result-links"]} data-testid="test-result-meta-links">
      <div className={styles["test-result-links-wrapper"]}>
        <MetadataButton
          isOpened={isOpened}
          setIsOpen={() => {
            if (linksId !== null) {
              toggleTree(linksId);
            }
          }}
          counter={links.length}
          title={t("links")}
        />
        {isOpened && (
          <>
            <div className={styles["test-result-links-list"]}>{linkMap}</div>
            {links.length > VISIBLE_LINKS_LIMIT && (
              <Button
                style="ghost"
                size="s"
                text={showAll ? t("showLess") : t("showMore")}
                onClick={() => {
                  if (linksShowAllId !== null) {
                    toggleTree(linksShowAllId);
                  }
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};
