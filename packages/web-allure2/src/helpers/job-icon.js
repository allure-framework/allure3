import allureIcon from "./allure-icon.js";

export default function (value, opts) {
  const knownJobs = ["github", "gitlab", "circleci", "jenkins", "teamcity", "bitbucket", "bamboo"];
  const jobIcon = knownJobs.includes(value) ? value : "jobs";

  return allureIcon(jobIcon, opts);
}
