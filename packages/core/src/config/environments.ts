import { type EnvironmentMatcherPayload, type EnvironmentsConfig, compilePredicate } from "@allurereport/core-api";
import type { Config } from "@allurereport/plugin-api";

const isConfigObject = (value: unknown) => typeof value === "object" && value !== null && !Array.isArray(value);

export const resolveEnvironments = (value: Config["environments"]): EnvironmentsConfig | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!isConfigObject(value)) {
    throw new Error("Invalid environments: expected an object");
  }

  return Object.fromEntries(
    Object.entries(value).map(([id, descriptor]) => {
      const path = `environments[${JSON.stringify(id)}]`;
      if (!isConfigObject(descriptor)) {
        throw new Error(`Invalid ${path}: expected an object`);
      }

      const { matcher } = descriptor;
      if (typeof matcher === "function") {
        return [id, { ...descriptor, matcher }];
      }
      if (typeof matcher !== "string") {
        throw new Error(`Invalid ${path}.matcher: expected a function or expression string`);
      }

      const predicate = compilePredicate(matcher, `${path}.matcher`, {
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
