import { SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { AwesomeTestResult } from "types";
import { MetadataButton } from "@/components/MetadataButton";
import { useI18n } from "@/stores/locale";
import * as styles from "./styles.scss";

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
  const { url, type } = link;

  return (
    <div className={styles["test-result-link"]}>
      <SvgIcon id={linksIconMap[type] ?? allureIcons.lineGeneralLink1} />
      <Text tag={"a"} href={url} target={"_blank"} size={"m"} className={styles["test-result-link-text"]}>
        {url}
      </Text>
    </div>
  );
};

export type TrLinksProps = {
  links: AwesomeTestResult["links"];
};

export const TrLinks: FunctionalComponent<TrLinksProps> = ({ links }) => {
  const [isOpened, setIsOpen] = useState(true);
  const { t } = useI18n("ui");
  const linkMap = links.map((link, index) => {
    return <TrLink link={link as TrLinkProps} key={index} />;
  });

  return (
    <div className={styles["test-result-links"]}>
      <div className={styles["test-result-links-wrapper"]}>
        <MetadataButton isOpened={isOpened} setIsOpen={setIsOpen} counter={links.length} title={t("links")} />
        {isOpened && <div className={styles["test-result-links-list"]}>{linkMap}</div>}
      </div>
    </div>
  );
};
