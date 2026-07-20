import type { TestParameter } from "../metadata.js";

const maskedParameterPlaceholder = "<masked>";

export const redactParameters = (parameters: readonly TestParameter[] | undefined): TestParameter[] => {
  return (parameters ?? [])
    .filter((parameter) => !parameter.hidden)
    .map((parameter) => ({
      ...parameter,
      value: parameter.masked ? maskedParameterPlaceholder : parameter.value,
    }));
};
