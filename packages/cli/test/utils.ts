import { vi } from "vitest";

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export const AllureReportMock = vi.fn(function () {});

AllureReportMock.prototype.readDirectory = vi.fn();

AllureReportMock.prototype.start = vi.fn();

AllureReportMock.prototype.update = vi.fn();

AllureReportMock.prototype.done = vi.fn();

AllureReportMock.prototype.validate = vi.fn();

AllureReportMock.prototype.dumpState = vi.fn();

AllureReportMock.prototype.restoreState = vi.fn();

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
