import { Spinner } from "@/components/Spinner";
import styles from "./styles.scss";

export const PageLoader = () => {
  return (
    <div className={styles["page-loader"]}>
      <Spinner size="m" />
    </div>
  );
};
