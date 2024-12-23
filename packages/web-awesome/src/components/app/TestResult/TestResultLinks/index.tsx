import { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import { AllureAwesomeTestResult } from "types";
import githubIcon from "@/assets/svg/github.svg";
import Bug from "@/assets/svg/line-dev-bug-2.svg";
import TmsLink from "@/assets/svg/line-general-checklist3.svg";
import Link from "@/assets/svg/line-general-link-1.svg";
import { MetadataButton } from "@/components/app/MetadataButton";
import { SvgIcon } from "@/components/commons/SvgIcon";
import { Text } from "@/components/commons/Typography";
import { useI18n } from "@/stores/locale";
import * as styles from "./styles.scss";

interface TestResultLinkProps {
  name: string;
  url: string;
  type: string;
}

const TestResultLink: FunctionalComponent<{
  link: TestResultLinkProps;
}> = ({ link }) => {
  const { url, type } = link;
  const iconMap = {
    issue: Bug.id,
    link: Link.id,
    tms: TmsLink.id,
    github: githubIcon.id,
  };

  return (
    <div className={styles["test-result-link"]}>
      <SvgIcon id={iconMap[type] ?? Link.id} />
      <Text tag={"a"} href={url} target={"_blank"} size={"m"} className={styles["test-result-link-text"]}>
        {url}
      </Text>
    </div>
  );
};

export type TestResultLinksProps = {
  links: AllureAwesomeTestResult["links"];
};

export const TestResultLinks: FunctionalComponent<TestResultLinksProps> = ({ links }) => {
  const [isOpened, setIsOpen] = useState(true);
  const { t } = useI18n("ui");
  const linkMap = links.map((link, index) => {
    return <TestResultLink link={link as TestResultLinkProps} key={index} />;
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
