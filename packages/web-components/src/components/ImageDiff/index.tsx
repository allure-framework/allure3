import { EmptyView } from "@/components/EmptyView";
import { Spinner } from "@/components/Spinner";
import { allureIcons } from "@/components/SvgIcon";
import { DiffModeSelector } from "./src/DiffModeSelector";
import { DiffModeView } from "./src/DiffModeView";
import { Wrapper } from "./src/Wrapper";
import { ImageDiffProvider, useImageDiffContext } from "./src/hooks";
import type { I18nProp } from "./src/i18n";
import { I18nProvider, useI18n } from "./src/i18n";
import type { ImageDiff as TImageDiff } from "./src/model";

type Props = {
  diff: TImageDiff;
  i18n?: I18nProp;
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
  const { i18n, diff } = props;

  return (
    <I18nProvider i18n={i18n}>
      <Wrapper>
        <ImageDiffProvider diff={diff}>
          <ImageDiffContent />
        </ImageDiffProvider>
      </Wrapper>
    </I18nProvider>
  );
};
