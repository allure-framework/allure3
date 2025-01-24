import { vi } from "vitest";

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export const AllureReportMock = vi.fn(function () {});

AllureReportMock.prototype.readDirectory = vi.fn();

AllureReportMock.prototype.start = vi.fn();

AllureReportMock.prototype.update = vi.fn();

AllureReportMock.prototype.done = vi.fn();
