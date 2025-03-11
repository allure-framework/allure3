import type { Attachments } from "@allurereport/web-commons";
import { fetchReportAttachment } from "@allurereport/web-commons";
import { Button } from "@allurereport/web-components";
import { PwTrace } from "@/components/TestResult/TrQuickActions/PwTrace";
import { openModal } from "@/stores/modal";

export const fetchFromUrl = async ({ id, ext, contentType }: Attachments) => {
  const fileName = `${id || "-"}${ext || ""}`;

  return fetchReportAttachment(`data/attachments/${fileName}?attachment`, contentType);
};

export const PwTraceButton = () => {
  const openPw = async () => {
    const hasPw = await fetchFromUrl({ id: "6f3e067cb83ee8412f6d35ca6765a884", ext: ".zip" });
    const blob = await hasPw.blob();

    openModal({
      data: {},
      component: <PwTrace blob={blob} />,
      title: "Playwright Trace",
    });
  };

  return <Button text={"Open Playwright trace"} onClick={openPw} />;
};
