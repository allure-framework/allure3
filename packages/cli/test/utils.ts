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

AllureServiceClientMock.prototype.login = vi.fn();

AllureServiceClientMock.prototype.logout = vi.fn();

AllureServiceClientMock.prototype.profile = vi.fn();

AllureServiceClientMock.prototype.createProject = vi.fn();

AllureServiceClientMock.prototype.projects = vi.fn();

AllureServiceClientMock.prototype.deleteProject = vi.fn();

AllureServiceClientMock.prototype.appendHistory = vi.fn();

AllureServiceClientMock.prototype.downloadHistory = vi.fn();

AllureServiceClientMock.prototype.createReport = vi.fn();
