import { CiType } from "@allurereport/core-api";
import { getReportOptions } from "@allurereport/web-commons";
import { cleanup, render, screen } from "@testing-library/preact";
import { epic, feature, label, story } from "allure-js-commons";
import { h } from "preact";
import { type Mock, beforeEach, describe, expect, it, vi } from "vite-plus/test";

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("CiInfo");
  await label("coverage", "ui-components");
});

import { CiInfo, getCiIconId, getCiLabel } from "@/components/Header/CiInfo";

const fixtures = {
  pullRequestUrl: "https://github.com/repo/pull/123",
  jobUrl: "https://github.com/repo/actions/runs/123",
  jobRunUrl: "https://github.com/repo/actions/runs/123/jobs/456",
  pullRequestName: "PR #123",
  jobName: "Build Job",
  jobRunName: "Run #456",
};

vi.mock("@allurereport/web-components/core", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    Text: (props: { children: string }) => <span>{props.children}</span>,
    SvgIcon: (props: { id: string; size?: string }) => <span data-testid="icon">{props.id}</span>,
  };
});
vi.mock("@allurereport/web-commons", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    getReportOptions: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe("components > Header > CiInfo", () => {
  it("should render well-known CI icon", () => {
    const ciTypes: CiType[] = [
      CiType.Amazon,
      CiType.Azure,
      CiType.Bitbucket,
      CiType.Circle,
      CiType.Drone,
      CiType.Github,
      CiType.Gitlab,
      CiType.Jenkins,
    ];

    for (const type of ciTypes) {
      (getReportOptions as Mock).mockReturnValueOnce({
        ci: {
          pullRequestUrl: fixtures.pullRequestUrl,
          type,
        },
      });

      cleanup();
      render(<CiInfo />);

      expect(screen.getByTestId("icon")).toHaveTextContent(type);
    }
  });

  it("shouldn't render icon for unknown CI", () => {
    (getReportOptions as Mock).mockReturnValueOnce({
      ci: {
        type: undefined,
      },
    });

    render(<CiInfo />);

    expect(screen.queryByTestId("icon")).not.toBeInTheDocument();
  });

  it("should render there is no link to use", () => {
    (getReportOptions as Mock).mockReturnValueOnce({
      ci: {},
    });

    render(<CiInfo />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("should presence pull request url as href when provided", () => {
    (getReportOptions as Mock).mockReturnValueOnce({
      ci: {
        pullRequestUrl: fixtures.pullRequestUrl,
        jobUrl: fixtures.jobUrl,
        jobRunUrl: fixtures.jobRunUrl,
      },
    });

    render(<CiInfo />);

    expect(screen.getByRole("link")).toHaveAttribute("href", fixtures.pullRequestUrl);
    expect(screen.getByRole("link")).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("should presence use job run url as href when provided", () => {
    (getReportOptions as Mock).mockReturnValueOnce({
      ci: {
        jobUrl: fixtures.jobUrl,
        jobRunUrl: fixtures.jobRunUrl,
      },
    });

    render(<CiInfo />);

    expect(screen.getByRole("link")).toHaveAttribute("href", fixtures.jobRunUrl);
  });

  it("should use job url as href when provided", () => {
    (getReportOptions as Mock).mockReturnValueOnce({
      ci: {
        jobRunUrl: fixtures.jobRunUrl,
      },
    });

    render(<CiInfo />);

    expect(screen.getByRole("link")).toHaveAttribute("href", fixtures.jobRunUrl);
  });

  it("should not render a clickable link when ci url has unsafe protocol", () => {
    (getReportOptions as Mock).mockReturnValueOnce({
      ci: {
        pullRequestUrl: "javascript:alert(1)",
        pullRequestName: fixtures.pullRequestName,
      },
    });

    render(<CiInfo />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("should presence pull request name as text when provided", () => {
    (getReportOptions as Mock).mockReturnValueOnce({
      ci: {
        pullRequestUrl: fixtures.pullRequestUrl,
        pullRequestName: fixtures.pullRequestName,
        jobName: fixtures.jobName,
        jobRunName: fixtures.jobRunName,
      },
    });

    render(<CiInfo />);

    expect(screen.getByRole("link")).toHaveTextContent(fixtures.pullRequestName);
  });

  it("should presence job run name as text when provided", () => {
    (getReportOptions as Mock).mockReturnValueOnce({
      ci: {
        jobUrl: fixtures.jobUrl,
        jobName: fixtures.jobName,
        jobRunName: fixtures.jobRunName,
      },
    });

    render(<CiInfo />);

    expect(screen.getByRole("link")).toHaveTextContent(fixtures.jobRunName);
  });

  it("should presence job name as text when provided", () => {
    (getReportOptions as Mock).mockReturnValueOnce({
      ci: {
        jobRunUrl: fixtures.jobRunUrl,
        jobRunName: fixtures.jobRunName,
      },
    });

    render(<CiInfo />);

    expect(screen.getByRole("link")).toHaveTextContent(fixtures.jobRunName);
  });

  it("should not render executor metadata in the header", () => {
    (getReportOptions as Mock).mockReturnValueOnce({
      executor: {
        name: "TeamCity",
        type: "teamcity",
        buildName: "Wrike #123",
        buildUrl: "https://teamcity.example/build/123",
      },
    });

    render(<CiInfo />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("TeamCity · Wrike #123")).not.toBeInTheDocument();
  });

  it("should render ci label as plain text when ci has a name but no link", () => {
    (getReportOptions as Mock).mockReturnValueOnce({
      ci: {
        jobName: "Nightly Build",
      },
    });

    render(<CiInfo />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Nightly Build")).toBeInTheDocument();
  });

  it("should ignore executor metadata when ci has no link", () => {
    (getReportOptions as Mock).mockReturnValueOnce({
      ci: {
        jobName: "Nightly Build",
      },
      executor: {
        name: "TeamCity",
        buildName: "Wrike #123",
        buildUrl: "https://teamcity.example/build/123",
      },
    });

    render(<CiInfo />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Nightly Build")).toBeInTheDocument();
    expect(screen.queryByText("TeamCity · Wrike #123")).not.toBeInTheDocument();
  });
});

describe("components > Header > CiInfo helpers", () => {
  it("should return the id of the icon for every well-known CI", () => {
    expect(getCiIconId(CiType.Amazon)).toBe("amazon");
    expect(getCiIconId(CiType.Azure)).toBe("azure");
    expect(getCiIconId(CiType.Bitbucket)).toBe("bitbucket");
    expect(getCiIconId(CiType.Circle)).toBe("circleci");
    expect(getCiIconId(CiType.Drone)).toBe("drone");
    expect(getCiIconId(CiType.Github)).toBe("github");
    expect(getCiIconId(CiType.Gitlab)).toBe("gitlab");
    expect(getCiIconId(CiType.Jenkins)).toBe("jenkins");
  });

  it("should not return an icon for the local run and for the unknown type", () => {
    expect(getCiIconId(CiType.Local)).toBeUndefined();
    expect(getCiIconId(undefined)).toBeUndefined();
  });

  it("should prefer the pull request, then the job run, then the job, then the link for the label", () => {
    const ci = { pullRequestName: "PR #1", jobRunName: "Run #2", jobName: "Job" } as Parameters<typeof getCiLabel>[0];

    expect(getCiLabel(ci, "https://example.com")).toBe("PR #1");
    expect(getCiLabel({ ...ci, pullRequestName: "" } as typeof ci, "https://example.com")).toBe("Run #2");
    expect(getCiLabel({ ...ci, pullRequestName: "", jobRunName: "" } as typeof ci, "https://example.com")).toBe("Job");
    expect(getCiLabel({ jobName: "" } as typeof ci, "https://example.com")).toBe("https://example.com");
  });

  it("should not have a label without CI", () => {
    expect(getCiLabel(undefined, "https://example.com")).toBeUndefined();
  });
});
