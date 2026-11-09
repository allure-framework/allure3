import { type CiDescriptor, CiType } from "@allurereport/core-api";

import { allureIcons } from "./index";

const ciIconIds: Partial<Record<CiType, string>> = {
  [CiType.Amazon]: allureIcons.amazon,
  [CiType.Azure]: allureIcons.azure,
  [CiType.Bitbucket]: allureIcons.bitbucket,
  [CiType.Circle]: allureIcons.circleci,
  [CiType.Drone]: allureIcons.drone,
  [CiType.Github]: allureIcons.github,
  [CiType.Gitlab]: allureIcons.gitlab,
  [CiType.Jenkins]: allureIcons.jenkins,
};

/**
 * Returns the id of the icon of the CI provider, there is no icon for an unknown or local CI
 */
export const getCiIconId = (type?: CiDescriptor["type"]) => (type ? ciIconIds[type] : undefined);
