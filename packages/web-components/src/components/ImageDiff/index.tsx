import { EmptyView } from "@/components/EmptyView";
import { Spinner } from "@/components/Spinner";
import { allureIcons } from "@/components/SvgIcon";
import type { ImageDiff as TImageDiff } from "../model";
import { DiffModeSelector } from "./src/DiffModeSelector";
import { DiffModeView } from "./src/DiffModeView";
import { Wrapper } from "./src/Wrapper";
import { ImageDiffProvider, useImageDiffContext } from "./src/hooks";
import { useI18n } from "./src/i18n";

type Props = {
  diff: TImageDiff;
};

const ImageDiffContent = () => {
  const i18n = useI18n();
  const { isLoading, failedToLoad } = useImageDiffContext();

  if (isLoading.value) {
    return <Spinner size="m" />;
  }

  if (failedToLoad.value) {
    return <EmptyView title={i18n("empty.failed-to-load") ?? "Failed to load"} icon={allureIcons.lineImagesImage} />;
  }

  return (
    <>
      <DiffModeSelector />
      <DiffModeView />
    </>
  );
};

export const ImageDiff = (props: Props) => {
  return (
    <Wrapper>
      <ImageDiffProvider diff={props.diff}>
        <ImageDiffContent />
      </ImageDiffProvider>
    </Wrapper>
  );
};
