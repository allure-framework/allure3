import path from "node:path";
import { vi } from "vitest";

export class AllureServiceMock {}

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export const AllureServiceClientMock = vi.fn(function () {});

AllureServiceClientMock.prototype.decodeToken = vi.fn();

AllureServiceClientMock.prototype.profile = vi.fn();

AllureServiceClientMock.prototype.generateNewAccessToken = vi.fn();

AllureServiceClientMock.prototype.projects = vi.fn();

AllureServiceClientMock.prototype.project = vi.fn();

AllureServiceClientMock.prototype.createProject = vi.fn();

AllureServiceClientMock.prototype.deleteProject = vi.fn();

AllureServiceClientMock.prototype.downloadHistory = vi.fn();

AllureServiceClientMock.prototype.createReport = vi.fn();

AllureServiceClientMock.prototype.completeReport = vi.fn();

AllureServiceClientMock.prototype.deleteReport = vi.fn();

AllureServiceClientMock.prototype.addReportAsset = vi.fn();

AllureServiceClientMock.prototype.addReportFile = vi.fn();

export const getDataPath = (name: string) => path.resolve(import.meta.filename, "..", "data", "history", name);
