import type { TestParameter } from "../metadata.js";

const maskedParameterPlaceholder = "<masked>";

export const redactParameters = (parameters: readonly TestParameter[] | undefined): TestParameter[] => {
  return (parameters ?? []).flatMap((parameter) => {
    if (parameter.hidden) {
      return [];
    }

    return [
      {
        ...parameter,
        value: parameter.masked ? maskedParameterPlaceholder : parameter.value,
      },
    ];
  });
};
