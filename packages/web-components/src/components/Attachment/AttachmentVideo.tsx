import { type FunctionalComponent } from "preact";
import { Spinner } from "@/components/Spinner";

export const AttachmentVideo: FunctionalComponent<{
  attachment: { src: string; contentType?: string };
}> = ({ attachment }) => {
  if (!attachment) {
    return <Spinner />;
  }
  return (
    <video controls loop muted>
      <source src={attachment?.src} type={attachment?.contentType} />
    </video>
  );
};
