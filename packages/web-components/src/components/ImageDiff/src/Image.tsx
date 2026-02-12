import classNames from "clsx";
import type { ImgHTMLAttributes } from "preact";
import styles from "./styles.scss";

export const Image = (props: ImgHTMLAttributes<HTMLImageElement>) => {
  const { className, ...rest } = props;

  return <img className={classNames(className, styles.image)} {...rest} draggable={false} />;
};
