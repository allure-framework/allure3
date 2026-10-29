import type { EnvironmentMatcherPayload, EnvironmentsConfig } from "@allurereport/core-api";
import type { Config } from "@allurereport/plugin-api";

import { compilePredicate } from "./expressions.js";

export const resolveEnvironments = (value: Config["environments"]): EnvironmentsConfig | undefined => {
  if (value === undefined) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value).map(([id, descriptor]) => {
      if (typeof descriptor.matcher !== "string") {
        return [id, { ...descriptor, matcher: descriptor.matcher }];
      }

      const predicate = compilePredicate(descriptor.matcher, `environments[${JSON.stringify(id)}].matcher`, {
        labels: "list",
      });
      return [
        id,
        {
          ...descriptor,
          matcher: ({ labels }: EnvironmentMatcherPayload) =>
            predicate({ labels: labels.map(({ name, value: labelValue }) => ({ name, value: labelValue ?? "" })) }),
        },
      ];
    }),
  );
};
