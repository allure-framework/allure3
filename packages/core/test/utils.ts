import { vi } from "vitest";

export class AllureServiceMock {}

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

AllureServiceClientMock.prototype.addReportAsset = vi.fn();

AllureServiceClientMock.prototype.addReportFile = vi.fn();

AllureServiceClientMock.prototype.completeReport = vi.fn();
