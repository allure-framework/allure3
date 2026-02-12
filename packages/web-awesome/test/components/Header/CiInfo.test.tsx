import { CiType } from "@allurereport/core-api";
import { getReportOptions } from "@allurereport/web-commons";
import { cleanup, render, screen } from "@testing-library/preact";
import { h } from "preact";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { CiInfo } from "@/components/Header/CiInfo";

const fixtures = {
  pullRequestUrl: "https://github.com/repo/pull/123",
  jobUrl: "https://github.com/repo/actions/runs/123",
  jobRunUrl: "https://github.com/repo/actions/runs/123/jobs/456",
  pullRequestName: "PR #123",
  jobName: "Build Job",
  jobRunName: "Run #456",
};

vi.mock("@allurereport/web-components", async () => {
  const { CiType } = await import("@allurereport/core-api");

  return {
    Text: (props: { children: string }) => <span>{props.children}</span>,
    SvgIcon: (props: { id: string; size?: string }) => <span data-testid="icon">{props.id}</span>,
    allureIcons: {
      amazon: "amazon",
      azure: "azure",
      bitbucket: "bitbucket",
      circleci: "circle",
      drone: "drone",
      github: "github",
      gitlab: "gitlab",
      jenkins: "jenkins",
    },
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
});
