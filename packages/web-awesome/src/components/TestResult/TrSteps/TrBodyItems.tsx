import type { FunctionalComponent } from "preact";

import type { TrBodyItem } from "@/components/TestResult/bodyItems";
import { TrAttachment } from "@/components/TestResult/TrSteps/TrAttachment";
import { TrErrorStep } from "@/components/TestResult/TrSteps/TrErrorStep";
import { TrStep } from "@/components/TestResult/TrSteps/TrStep";

const getBodyItemKey = (item: TrBodyItem, index: number) => {
  switch (item.type) {
    case "step":
      return item.item.stepId ?? `${item.item.name}-${index}`;
    case "attachment":
      return item.link.id;
    case "error":
      return item.id;
    default:
      return `${index}`;
  }
};

export type TrBodyItemsProps = {
  bodyItems: TrBodyItem[];
};

export const TrBodyItems: FunctionalComponent<TrBodyItemsProps> = ({ bodyItems }) => {
  return (
    <>
      {bodyItems.map((item, index) => {
        switch (item.type) {
          case "step":
            return <TrStep item={item} stepIndex={index + 1} key={getBodyItemKey(item, index)} />;
          case "attachment":
            return <TrAttachment item={item} stepIndex={index + 1} key={getBodyItemKey(item, index)} />;
          case "error":
            return <TrErrorStep item={item} stepIndex={index + 1} key={getBodyItemKey(item, index)} />;
          default:
            return null;
        }
      })}
    </>
  );
};
