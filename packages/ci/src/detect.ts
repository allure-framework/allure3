import { amazon } from "./detectors/amazon.js";
import { azure } from "./detectors/azure.js";
import { bitbucket } from "./detectors/bitbucket.js";
import { circle } from "./detectors/circle.js";
import { drone } from "./detectors/drone.js";
import { github } from "./detectors/github.js";
import { gitlab } from "./detectors/gitlab.js";
import { jenkins } from "./detectors/jenkins.js";
import type { Detector } from "./model.js";

export const detect = (): Detector | undefined => {
  return [amazon, azure, bitbucket, circle, drone, github, gitlab, jenkins].find((detector) => detector.detected);
};
