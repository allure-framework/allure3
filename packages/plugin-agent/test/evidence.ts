import { attachment, step } from "allure-js-commons";
import { expect } from "vitest";

const formatJson = (value: unknown) => JSON.stringify(value, null, 2);

export const attachJsonEvidence = async (name: string, value: unknown) => {
  await attachment(name, formatJson(value), "application/json");
};

export const attachTextEvidence = async (name: string, value: string, contentType: string = "text/plain") => {
  await attachment(name, value, contentType);
};

export const expectTextToContainAll = async (artifactName: string, content: string, expectedText: string[]) => {
  await step(`verify ${artifactName} required text`, async () => {
    const missing = expectedText.filter((expected) => !content.includes(expected));

    await attachJsonEvidence(`${artifactName} required text`, {
      checked: expectedText,
      missing,
    });
    expect(missing).toEqual([]);
  });
};
