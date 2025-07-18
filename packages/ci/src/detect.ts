import type { CiDescriptor } from "@allurereport/core-api";
import { amazon } from "./detectors/amazon.js";
import { azure } from "./detectors/azure.js";
import { bitbucket } from "./detectors/bitbucket.js";
import { circle } from "./detectors/circle.js";
import { drone } from "./detectors/drone.js";
import { github } from "./detectors/github.js";
import { gitlab } from "./detectors/gitlab.js";
import { jenkins } from "./detectors/jenkins.js";

/**
 * Tries to detect current CI
 * Returns CI descriptor if some detected, otherwise undefined
 */
export const detect = (): CiDescriptor | undefined => {
  return [amazon, azure, bitbucket, circle, drone, github, gitlab, jenkins].find((descriptor) => descriptor.detected);
};
