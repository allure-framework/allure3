import type { ComponentChildren } from "preact";
import * as styles from "./styles.scss";

type Props = {
  href?: string;
  children: ComponentChildren;
  onClick?: (e: MouseEvent) => void;
};

export const Link = (props: Props) => {
  const { children, onClick, href } = props;
  const isPseudoLink = href === undefined;
  const Tag = isPseudoLink ? "button" : "a";

  return (
    <Tag href={href} onClick={onClick} className={styles.link}>
      {children}
    </Tag>
  );
};
