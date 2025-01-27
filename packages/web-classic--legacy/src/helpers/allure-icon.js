import { SafeString } from "handlebars/runtime.js";
import allureLogo from "@/assets/icons/allure-logo.svg";
import bamboo from "@/assets/icons/bamboo.svg";
import bitbucket from "@/assets/icons/bitbucket.svg";
import bomb from "@/assets/icons/bomb.svg";
import broken from "@/assets/icons/broken.svg";
import bug from "@/assets/icons/bug.svg";
import chevronDown from "@/assets/icons/chevron-down.svg";
import chevronLeft from "@/assets/icons/chevron-left.svg";
import chevronRightFat from "@/assets/icons/chevron-right-fat.svg";
import chevronRight from "@/assets/icons/chevron-right.svg";
import chevronUp from "@/assets/icons/chevron-up.svg";
import circleci from "@/assets/icons/circleci.svg";
import close from "@/assets/icons/close.svg";
import collapse from "@/assets/icons/collapse.svg";
import compare from "@/assets/icons/compare.svg";
import copy from "@/assets/icons/copy.svg";
import csv from "@/assets/icons/csv.svg";
import download from "@/assets/icons/download.svg";
import draggable from "@/assets/icons/draggable.svg";
import expand from "@/assets/icons/expand.svg";
import failed from "@/assets/icons/failed.svg";
import file from "@/assets/icons/file.svg";
import folder from "@/assets/icons/folder.svg";
import github from "@/assets/icons/github.svg";
import gitlab from "@/assets/icons/gitlab.svg";
import graphs from "@/assets/icons/graphs.svg";
import info from "@/assets/icons/info.svg";
import jenkins from "@/assets/icons/jenkins.svg";
import jobs from "@/assets/icons/jobs.svg";
import link from "@/assets/icons/link.svg";
import list from "@/assets/icons/list.svg";
import maximize from "@/assets/icons/maximize.svg";
import newBroken from "@/assets/icons/new-broken.svg";
import newFailed from "@/assets/icons/new-failed.svg";
import newPassed from "@/assets/icons/new-passed.svg";
import overview from "@/assets/icons/overview.svg";
import passed from "@/assets/icons/passed.svg";
import pdf from "@/assets/icons/pdf.svg";
import retries from "@/assets/icons/retries.svg";
import save from "@/assets/icons/save.svg";
import skipped from "@/assets/icons/skipped.svg";
import sortDown from "@/assets/icons/sort-down.svg";
import sortUp from "@/assets/icons/sort-up.svg";
import sort from "@/assets/icons/sort.svg";
import task from "@/assets/icons/task.svg";
import teamcity from "@/assets/icons/teamcity.svg";
import timeline from "@/assets/icons/timeline.svg";
import tree from "@/assets/icons/tree.svg";
import txt from "@/assets/icons/txt.svg";
import unknown from "@/assets/icons/unknown.svg";
import translate from "./t.js";

const icons = {
  jobs: {
    id: jobs.id,
  },
  draggable: {
    id: draggable.id,
  },
  github: {
    id: github.id,
  },
  gitlab: {
    id: gitlab.id,
  },
  teamcity: {
    id: teamcity.id,
  },
  jenkins: {
    id: jenkins.id,
  },
  bitbucket: {
    id: bitbucket.id,
  },
  bamboo: {
    id: bamboo.id,
  },
  circleci: {
    id: circleci.id,
  },
  maximize: {
    id: maximize.id,
  },
  expand: {
    id: expand.id,
  },
  collapse: {
    id: collapse.id,
  },
  close: {
    id: close.id,
  },
  bug: {
    id: bug.id,
  },
  compare: {
    id: compare.id,
  },
  save: {
    id: save.id,
  },
  link: {
    id: link.id,
  },
  file: {
    id: file.id,
  },
  txt: {
    id: txt.id,
  },
  pdf: {
    id: pdf.id,
  },
  csv: {
    id: csv.id,
  },
  chevronDown: {
    id: chevronDown.id,
  },
  chevronRight: {
    id: chevronRight.id,
  },
  chevronRightFat: {
    id: chevronRightFat.id,
  },
  chevronUp: {
    id: chevronUp.id,
  },
  chevronLeft: {
    id: chevronLeft.id,
  },
  sort: {
    id: sort.id,
  },
  sortUp: {
    id: sortUp.id,
  },
  sortDown: {
    id: sortDown.id,
  },
  task: {
    id: task.id,
  },
  graphs: {
    id: graphs.id,
  },
  overview: {
    id: overview.id,
  },
  tree: {
    id: tree.id,
  },
  timeline: {
    id: timeline.id,
  },
  folder: {
    id: folder.id,
  },
  list: {
    id: list.id,
  },
  copy: {
    id: copy.id,
  },
  allureLogo: {
    id: allureLogo.id,
  },
  info: {
    id: info.id,
  },
  download: {
    id: download.id,
  },
  flaky: {
    id: bomb.id,
    tooltip: "marks.flaky",
  },
  newFailed: {
    id: newFailed.id,
    tooltip: "marks.newFailed",
  },
  newBroken: {
    id: newBroken.id,
    tooltip: "marks.newBroken",
  },
  newPassed: {
    id: newPassed.id,
    tooltip: "marks.newPassed",
  },
  retriesStatusChange: {
    id: retries.id,
    tooltip: "marks.retriesStatusChange",
  },
  failed: {
    id: failed.id,
    tooltip: "status.failed",
  },
  broken: {
    id: broken.id,
    tooltip: "status.broken",
  },
  passed: {
    id: passed.id,
    tooltip: "status.passed",
  },
  skipped: {
    id: skipped.id,
    tooltip: "status.skipped",
  },
  unknown: {
    id: unknown.id,
    tooltip: "status.unknown",
  },
};

export default function (value, opts) {
  const {
    hash: { extraClasses = "", noTooltip = false, width = "20px", height = "20px" },
  } = opts;
  const icon = icons[value];

  return icon
    ? new SafeString(
        `<svg width="${width}" height="${height}" class="${extraClasses}" ${noTooltip ? "" : `data-tooltip="${translate(icon.tooltip)}"`}><use xlink:href="#${icon.id}"></use></svg>`,
      )
    : "";
}
