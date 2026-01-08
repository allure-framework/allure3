import type { TestStatusTransition } from "@allurereport/core-api";

export const testTypeFiltersList = ["flaky", "retry"];

export const transitionFiltersList = ["new", "fixed", "regressed", "malfunctioned"] as TestStatusTransition[];

export const filtersList = [...testTypeFiltersList, ...transitionFiltersList] as const;
