import console from "node:console";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Plugin, PluginContext, PluginPublishContext, PluginPublishResult } from "@allurereport/plugin-api";
import { AllureServiceClient, type AllureServiceApiClient } from "@allurereport/service";
import { generateSummary } from "@allurereport/summary";
import pLimit from "p-limit";
import ProgressBar from "progress";

import { isServiceReportFile, remoteReportParams, type StoragePluginOptions } from "./model.js";

const REMOTE_UPLOAD_MAX_ATTEMPTS = 5;
const REMOTE_UPLOAD_MAX_SIMULTANEOUS_FAILED = 5;

export class StoragePlugin implements Plugin {
  readonly #allureServiceClient: AllureServiceApiClient | undefined;
  readonly #enabled: boolean;
  readonly #remoteReports = new Map<string, string>();

  constructor(options: StoragePluginOptions = {}) {
    this.#enabled = !!options.publish;

    if (!options.accessToken) {
      return;
    }

    this.#allureServiceClient = new AllureServiceClient(options);
  }

  #createRemoteReport = async (context: Pick<PluginContext, "reportUuid" | "reportName" | "ci">) => {
    const existingReportUrl = this.#remoteReports.get(context.reportUuid);

    if (!this.#allureServiceClient || existingReportUrl) {
      return existingReportUrl;
    }

    const url = await this.#allureServiceClient.createReport({
      reportUuid: context.reportUuid,
      reportName: context.reportName,
      ...remoteReportParams(context.ci),
    });

    this.#remoteReports.set(context.reportUuid, url.href);

    return url.href;
  };

  async start(context: PluginContext) {
    if (!this.#enabled || !this.#allureServiceClient || !context.publish || context.realTime) {
      return;
    }

    context.reportUrl = await this.#createRemoteReport(context);
  }

  async publish(context: PluginPublishContext): Promise<PluginPublishResult | undefined> {
    if (!this.#enabled || !this.#allureServiceClient) {
      return undefined;
    }

    const reportsToPublish = context.reports.filter(({ publish, files }) => publish && Object.keys(files).length > 0);

    if (reportsToPublish.length === 0) {
      return undefined;
    }

    await this.#createRemoteReport(context);

    const result: PluginPublishResult = {
      linksByPluginId: {},
    };
    const cancelledPluginsIds: Set<string> = new Set();
    const successfulPluginIds: Set<string> = new Set();

    for (const report of reportsToPublish) {
      const pluginFilesEntries = Object.entries(report.files);
      const progressBar =
        pluginFilesEntries.length > 0
          ? new ProgressBar(`Publishing "${report.pluginId}" report [:bar] :current/:total`, {
              total: pluginFilesEntries.length,
              width: 20,
            })
          : undefined;
      const limitFn = pLimit(50);
      const uploadAbortController = new AbortController();
      const failedUploads = new Set<string>();
      const uploadWithRetry = async (filename: string, uploadFn: () => Promise<void>) => {
        for (let attempt = 1; attempt <= REMOTE_UPLOAD_MAX_ATTEMPTS; attempt++) {
          if (cancelledPluginsIds.has(report.pluginId) || uploadAbortController.signal.aborted) {
            return false;
          }

          try {
            await uploadFn();
            failedUploads.delete(filename);

            return true;
          } catch (err) {
            if (uploadAbortController.signal.aborted) {
              return false;
            }

            failedUploads.add(filename);

            if (failedUploads.size > REMOTE_UPLOAD_MAX_SIMULTANEOUS_FAILED || attempt >= REMOTE_UPLOAD_MAX_ATTEMPTS) {
              throw err;
            }
          }
        }

        return false;
      };
      const fns = pluginFilesEntries.map(([filename, filepath]) =>
        limitFn(async () => {
          if (cancelledPluginsIds.has(report.pluginId) || uploadAbortController.signal.aborted) {
            return;
          }

          let uploadedFileUrl: string | undefined;
          const uploaded = await uploadWithRetry(filename, async () => {
            if (isServiceReportFile(filename)) {
              uploadedFileUrl = await this.#allureServiceClient!.addReportFile({
                reportUuid: context.reportUuid,
                pluginId: report.pluginId,
                filename,
                filepath,
                signal: uploadAbortController.signal,
              });
            } else {
              await this.#allureServiceClient!.addReportAsset({
                filename,
                filepath,
                signal: uploadAbortController.signal,
              });
            }
          });

          if (!uploaded || cancelledPluginsIds.has(report.pluginId) || uploadAbortController.signal.aborted) {
            return;
          }

          if (filename === "index.html" && uploadedFileUrl) {
            result.linksByPluginId[report.pluginId] = uploadedFileUrl;
            result.remoteHref ??= uploadedFileUrl;
            const summary = context.summary?.summaries?.find(({ pluginId }) => pluginId === report.pluginId);

            if (summary) {
              summary.remoteHref ??= uploadedFileUrl;
            }
          }

          if (cancelledPluginsIds.has(report.pluginId) || uploadAbortController.signal.aborted) {
            return;
          }

          progressBar?.tick?.();
        }),
      );

      progressBar?.render?.();

      try {
        await Promise.all(fns);

        if (result.linksByPluginId[report.pluginId]) {
          successfulPluginIds.add(report.pluginId);
        }
      } catch (err) {
        cancelledPluginsIds.add(report.pluginId);
        uploadAbortController.abort();

        await Promise.allSettled(fns);

        const pluginRemoteHref = result.linksByPluginId[report.pluginId];

        delete result.linksByPluginId[report.pluginId];
        successfulPluginIds.delete(report.pluginId);

        if (result.remoteHref === pluginRemoteHref) {
          const [nextRemoteHref] = Object.values(result.linksByPluginId);

          result.remoteHref = nextRemoteHref;
        }

        await this.#allureServiceClient.deleteReport({
          reportUuid: context.reportUuid,
          pluginId: report.pluginId,
        });

        console.error(`Plugin "${report.pluginId}" upload has failed, the plugin won't be published`);
        console.error(err);
      }
    }

    if (successfulPluginIds.size === 0) {
      return Object.keys(result.linksByPluginId).length > 0 || result.remoteHref ? result : undefined;
    }

    if (context.summary?.filepath && successfulPluginIds.size > 1) {
      let summaryPath: string | undefined = context.summary.filepath;
      let summaryTempDir: string | undefined;

      try {
        if (context.summary.summaries?.length) {
          const summariesToPublish =
            cancelledPluginsIds.size > 0
              ? context.summary.summaries.filter(({ pluginId }) => pluginId && successfulPluginIds.has(pluginId))
              : context.summary.summaries;

          if (summariesToPublish.length > 1) {
            summaryTempDir = await mkdtemp(join(tmpdir(), "allure3-service-summary-"));
            summaryPath = await generateSummary(summaryTempDir, summariesToPublish);
          } else {
            summaryPath = undefined;
          }
        } else if (cancelledPluginsIds.size > 0) {
          summaryPath = undefined;
        }

        if (summaryPath) {
          const summaryHref = await this.#allureServiceClient.addReportFile({
            reportUuid: context.reportUuid,
            filename: "index.html",
            filepath: summaryPath,
          });

          if (summaryHref) {
            result.remoteHref = summaryHref;
          }
        }
      } finally {
        if (summaryTempDir) {
          try {
            await rm(summaryTempDir, { recursive: true });
          } catch {}
        }
      }
    }

    await this.#allureServiceClient.completeReport({
      reportUuid: context.reportUuid,
      historyPoint: context.historyPoint,
    });

    return result;
  }
}
