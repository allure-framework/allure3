import { CiDescriptor, CiType } from "@allurereport/core-api";
import { cleanup, render, screen } from "@testing-library/preact";
import { h } from "preact";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

beforeEach(() => {
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
      const ci = {
        pullRequestUrl: fixtures.pullRequestUrl,
        type,
      } as CiDescriptor;

      cleanup();
      render(<CiInfo ci={ci} />);

      expect(screen.getByTestId("icon")).toHaveTextContent(type);
    }
  });

  it("shouldn't render icon for unknown CI", () => {
    const ci = {
      type: undefined,
    } as CiDescriptor;

    render(<CiInfo ci={ci} />);

    expect(screen.queryByTestId("icon")).not.toBeInTheDocument();
  });

  it("should render there is no link to use", () => {
    const ci = {} as CiDescriptor;

    render(<CiInfo ci={ci} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("should presence pull request url as href when provided", () => {
    const ci = {
      pullRequestUrl: fixtures.pullRequestUrl,
      jobUrl: fixtures.jobUrl,
      jobRunUrl: fixtures.jobRunUrl,
    } as CiDescriptor;

    render(<CiInfo ci={ci} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", fixtures.pullRequestUrl);
  });

  it("should presence use job url as href when provided", () => {
    const ci = {
      jobUrl: fixtures.jobUrl,
      jobRunUrl: fixtures.jobRunUrl,
    } as CiDescriptor;

    render(<CiInfo ci={ci} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", fixtures.jobUrl);
  });

  it("should use job run url as href when provided", () => {
    const ci = {
      jobRunUrl: fixtures.jobRunUrl,
    } as CiDescriptor;

    render(<CiInfo ci={ci} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", fixtures.jobRunUrl);
  });

  it("should presence pull request name as text when provided", () => {
    const ci = {
      pullRequestUrl: fixtures.pullRequestUrl,
      pullRequestName: fixtures.pullRequestName,
      jobName: fixtures.jobName,
      jobRunName: fixtures.jobRunName,
    } as CiDescriptor;

    render(<CiInfo ci={ci} />);

    expect(screen.getByRole("link")).toHaveTextContent(fixtures.pullRequestName);
  });

  it("should presence job name as text when provided", () => {
    const ci = {
      jobUrl: fixtures.jobUrl,
      jobName: fixtures.jobName,
      jobRunName: fixtures.jobRunName,
    } as CiDescriptor;

    render(<CiInfo ci={ci} />);

    expect(screen.getByRole("link")).toHaveTextContent(fixtures.jobName);
  });

  it("should presence job run name as text when provided", () => {
    const ci = {
      jobRunUrl: fixtures.jobRunUrl,
      jobRunName: fixtures.jobRunName,
    } as CiDescriptor;

    render(<CiInfo ci={ci} />);

    expect(screen.getByRole("link")).toHaveTextContent(fixtures.jobRunName);
  });
});
