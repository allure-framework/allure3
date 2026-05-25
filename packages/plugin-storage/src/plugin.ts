import { Logger } from "@allurereport/cli-commons";
import type { HistoryDataPoint } from "@allurereport/core-api";
import type { AllureStore, Plugin, PluginContext } from "@allurereport/plugin-api";
import { AllureServiceClient, KnownError, type AllureServiceApiClient } from "@allurereport/service";
import pLimit from "p-limit";

import { isServiceReportFile, remoteReportParams, type StoragePluginOptions } from "./model.js";

const REMOTE_UPLOAD_MAX_ATTEMPTS = 5;
const REPORT_UPLOAD_CONCURRENCY = 50;

const errorDetails = (error: unknown) => (error instanceof Error ? (error.stack ?? error.message) : String(error));
const isFatalUploadServiceError = (error: unknown) =>
  error instanceof KnownError && (error.status === 401 || error.status === 404);

export class StoragePlugin implements Plugin {
  readonly #allureServiceClient: AllureServiceApiClient | undefined;
  readonly #remoteReports = new Map<string, string>();
  #logger = new Logger("StoragePlugin");

  constructor(options: StoragePluginOptions = {}) {
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

  // TODO: why did we assign reportUrl here?
  // async start(context: PluginContext) {
  //   if (!this.#allureServiceClient || context.realTime) {
  //     return;
  //   }

  //   context.reportUrl = await this.#createRemoteReport(context);
  // }

  async publish(params: {
    publisherContext: PluginContext;
    context: PluginContext;
    store: AllureStore;
    historyDataPoint?: HistoryDataPoint;
  }) {
    const { context, historyDataPoint } = params;

    if (!this.#allureServiceClient) {
      return undefined;
    }

    const allureServiceClient = this.#allureServiceClient;
    const files = (await context.state.get<Record<string, string>>("files")) ?? {};
    const reportUrlHref = await this.#createRemoteReport(context);

    if (!reportUrlHref) {
      return undefined;
    }

    const reportUrl = new URL(reportUrlHref);
    const newHistoryDataPoint = historyDataPoint
      ? {
          ...historyDataPoint,
          links: [...historyDataPoint.links],
        }
      : undefined;

    if (newHistoryDataPoint) {
      newHistoryDataPoint.links.push({
        id: context.id,
        url: reportUrl.toString(),
      });
    }

    let fatalUploadError: unknown;
    const entries = Object.entries(files);
    const progress = entries.length
      ? this.#logger.progressBarCounter(`Publishing "${context.id}" report`, entries.length)
      : undefined;
    const failedUploads = new Map<string, unknown>();
    const uploadAbortController = new AbortController();
    const uploadLimit = pLimit(REPORT_UPLOAD_CONCURRENCY);
    const uploadWithRetry = async (filename: string, upload: () => Promise<unknown>) => {
      for (let attempt = 1; attempt <= REMOTE_UPLOAD_MAX_ATTEMPTS; attempt++) {
        if (uploadAbortController.signal.aborted) {
          return false;
        }

        try {
          await upload();

          failedUploads.delete(filename);

          return true;
        } catch (error) {
          if (uploadAbortController.signal.aborted) {
            return false;
          }

          failedUploads.set(filename, error);

          if (isFatalUploadServiceError(error)) {
            fatalUploadError = error;

            throw error;
          }

          if (attempt >= REMOTE_UPLOAD_MAX_ATTEMPTS) {
            throw error;
          }

          this.#logger.debug(
            `Failed to upload "${filename}" (attempt ${attempt}/${REMOTE_UPLOAD_MAX_ATTEMPTS}): ${errorDetails(error)}`,
          );
        }
      }

      return false;
    };
    const uploadTasks = entries.map(([filename, filepath]) =>
      uploadLimit(async () => {
        if (uploadAbortController.signal.aborted) {
          return;
        }

        const uploaded = await uploadWithRetry(filename, async () => {
          if (isServiceReportFile(filename)) {
            await allureServiceClient.addReportFile({
              reportUuid: context.reportUuid,
              pluginId: context.id,
              filename,
              filepath,
              signal: uploadAbortController.signal,
            });

            return;
          }

          await allureServiceClient.addReportAsset({
            filename,
            filepath,
            signal: uploadAbortController.signal,
          });
        });

        if (uploaded && !uploadAbortController.signal.aborted) {
          progress?.tick();
        }
      }),
    );

    try {
      await Promise.all(uploadTasks);
    } catch (error) {
      uploadAbortController.abort();

      await Promise.allSettled(uploadTasks);

      const errorToRethrow = isFatalUploadServiceError(error) ? error : fatalUploadError;

      try {
        await allureServiceClient.deleteReport({
          reportUuid: context.reportUuid,
          pluginId: context.id,
        });
      } catch (cleanupError) {
        this.#logger.error("Failed to clean up failed Storage report upload");
        this.#logger.debug(errorDetails(cleanupError));
      }

      const failedFilenames = [...failedUploads.keys()];

      this.#logger.error(
        `Storage upload failed for ${failedFilenames.length} file(s)${
          failedFilenames.length ? `: ${failedFilenames.join(", ")}` : ""
        }`,
      );
      this.#logger.debug(errorDetails(error));

      if (errorToRethrow) {
        throw errorToRethrow;
      }

      return undefined;
    } finally {
      progress?.terminate();
    }

    await allureServiceClient.completeReport({
      reportUuid: context.reportUuid,
      historyPoint: newHistoryDataPoint,
    });

    return {
      url: reportUrl.toString(),
      // historyDataPoint: newHistoryDataPoint,
    };
  }
}
