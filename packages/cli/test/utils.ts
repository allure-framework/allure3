import { vi } from "vitest";

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export const AllureReportMock = vi.fn(function () {});

AllureReportMock.prototype.readDirectory = vi.fn();

AllureReportMock.prototype.start = vi.fn();

AllureReportMock.prototype.update = vi.fn();

AllureReportMock.prototype.done = vi.fn();

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export const AllureServiceMock = vi.fn(function () {});

AllureServiceMock.prototype.login = vi.fn();

AllureServiceMock.prototype.logout = vi.fn();

AllureServiceMock.prototype.profile = vi.fn();

AllureServiceMock.prototype.createProject = vi.fn();

AllureServiceMock.prototype.projects = vi.fn();

AllureServiceMock.prototype.deleteProject = vi.fn();

AllureServiceMock.prototype.appendHistory = vi.fn();

AllureServiceMock.prototype.downloadHistory = vi.fn();

AllureServiceMock.prototype.createReport = vi.fn();
