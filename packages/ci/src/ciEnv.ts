import { env } from "node:process";

export const applyAllureCiEnv = (): void => {
  const encodedAllureCiEnv = env.ALLURE_CI_ENV;

  if (!encodedAllureCiEnv) {
    return;
  }

  try {
    const decodedAllureCiEnv = JSON.parse(Buffer.from(encodedAllureCiEnv, "base64").toString("utf8")) as Record<
      string,
      string
    >;

    for (const [variableName, variableValue] of Object.entries(decodedAllureCiEnv)) {
      if (variableName.startsWith("ALLURE_")) {
        env[variableName] = variableValue;
      }
    }
  } catch {
    return;
  }
};
