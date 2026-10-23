import type { Meta, StoryObj } from "@storybook/preact-vite";

import { DropdownButton } from "@/components/Button";
import { Menu } from "@/components/Menu";
import { MiddleEllipsis } from "@/components/MiddleEllipsis";
import { SvgIcon, allureIcons } from "@/components/SvgIcon";
import { Text } from "@/components/Typography";

const meta: Meta<Parameters<typeof Menu>[0] & ExtraArgs> = {
  title: "Commons/Menu",
  component: Menu,
  parameters: { layout: "padded" },
  argTypes: {
    isInitialOpened: {
      control: "boolean",
      description: "Controls whether the menu is open initially.",
    },
    size: {
      control: { type: "select" },
      options: ["xs", "s", "m", "l", "xl"],
      description: "Sets the size of the menu.",
    },
    placement: {
      control: { type: "select" },
      options: ["bottom-start", "bottom-end"],
      description: "Controls the placement of the menu relative to the trigger.",
    },
    // the arguments of the stories, not of the menu: the trigger is the button of the design system and is sized apart from the menu
    triggerSize: {
      control: { type: "select" },
      options: ["auto", "xs", "s", "m", "l"],
      description: "Story only. The size of the button of the trigger, auto follows the size of the menu.",
    },
    triggerIconSize: {
      control: { type: "select" },
      options: ["auto", "xs"],
      description:
        "Story only. The size of the icon in the button of the trigger, auto follows the size of the button.",
    },
  },
};

export default meta;
type Story = StoryObj<Parameters<typeof Menu>[0] & ExtraArgs>;

export const DefaultMenu: Story = {
  args: {
    isInitialOpened: false,
    size: "m",
    placement: "bottom-end",
    // @ts-ignore
    menuTrigger: ({ onClick, isOpened }) => <button onClick={onClick}>{isOpened ? "Close Menu" : "Open Menu"}</button>,
  },
  render: (args) => (
    <Menu {...args}>
      <Menu.Section>
        <Menu.Item onClick={() => alert("Item 1 clicked")}>Item 1</Menu.Item>
        <Menu.Item onClick={() => alert("Item 2 clicked")}>Item 2</Menu.Item>
      </Menu.Section>
      <Menu.Section>
        <Menu.ItemWithCheckmark isChecked={true} onClick={() => alert("Item with checkmark clicked")}>
          Checked Item
        </Menu.ItemWithCheckmark>
        <Menu.ItemWithCheckmark isChecked={false} onClick={() => alert("Unchecked Item clicked")}>
          Unchecked Item
        </Menu.ItemWithCheckmark>
      </Menu.Section>
    </Menu>
  ),
};

export const ItemsWithIconAndSlot: Story = {
  args: {
    isInitialOpened: false,
    size: "m",
    placement: "bottom-start",
    // @ts-ignore
    menuTrigger: ({ onClick, isOpened }) => <button onClick={onClick}>{isOpened ? "Close Menu" : "Open Menu"}</button>,
  },
  render: (args) => (
    <Menu {...args}>
      <Menu.Section>
        <Menu.Item leadingIcon={allureIcons.lineGeneralCopy3} rightSlot={<span>⌘C</span>} onClick={() => {}}>
          Copy
        </Menu.Item>
        <Menu.Item leadingIcon={allureIcons.lineGeneralDownloadCloud} closeMenuOnClick={false} onClick={() => {}}>
          Download (keeps menu open)
        </Menu.Item>
      </Menu.Section>
    </Menu>
  ),
};

// @ts-ignore
export const WithCustomPlacement: Story = {
  args: {
    isInitialOpened: false,
    size: "m",
    placement: "bottom-start",
    // @ts-ignore
    menuTrigger: ({ onClick, isOpened }) => <button onClick={onClick}>{isOpened ? "Close Menu" : "Open Menu"}</button>,
  },
  render: (args) => (
    <Menu {...args}>
      <Menu.Section>
        <Menu.Item onClick={() => alert("Item 1 clicked")}>Item 1</Menu.Item>
        <Menu.Item onClick={() => alert("Item 2 clicked")}>Item 2</Menu.Item>
      </Menu.Section>
    </Menu>
  ),
};

export const WithIcons: Story = {
  args: {
    isInitialOpened: false,
    size: "m",
    placement: "bottom-end",
    // @ts-ignore
    menuTrigger: ({ onClick, isOpened }) => <button onClick={onClick}>{isOpened ? "Close Menu" : "Open Menu"}</button>,
  },
  render: (args) => (
    <Menu {...args}>
      <Menu.Section>
        <Menu.Item leadingIcon="icon-id-1" onClick={() => alert("Item 1 clicked")}>
          Item with Icon 1
        </Menu.Item>
        <Menu.Item leadingIcon="icon-id-2" onClick={() => alert("Item 2 clicked")}>
          Item with Icon 2
        </Menu.Item>
      </Menu.Section>
    </Menu>
  ),
};

export const CustomContent: Story = {
  args: {
    isInitialOpened: true,
    size: "xl",
    placement: "bottom-start",
    // @ts-ignore
    menuTrigger: ({ onClick, isOpened }) => <button onClick={onClick}>{isOpened ? "Close Menu" : "Open Menu"}</button>,
  },
  render: (args) => (
    <Menu {...args}>
      <Menu.Section>
        <Menu.Item>Custom Content</Menu.Item>
        <Menu.Item>
          <Text size="m" type="paragraph">
            This is custom text inside the menu.
          </Text>
        </Menu.Item>
      </Menu.Section>
    </Menu>
  ),
};

const externalLinkIcon = <SvgIcon id={allureIcons.lineGeneralLinkExternal} />;

// the trigger of the menu is the button of the design system. By default its size (and the size of the icon) follows the size of the menu,
// but they are independent: a small icon in the button can open the menu with the large ones, and the other way round
const triggerSizes = { xs: "s", s: "m", m: "l", l: "l", xl: "l" } as const;

type TriggerSize = "auto" | "xs" | "s" | "m" | "l";
type TriggerIconSize = "auto" | "xs";
type ExtraArgs = { triggerSize?: TriggerSize; triggerIconSize?: TriggerIconSize };
type TriggerProps = ExtraArgs & { onClick: () => void; isOpened: boolean; size?: keyof typeof triggerSizes };

const trigger =
  (text: string, icon?: string) =>
  ({ onClick, isOpened, size = "xs", triggerSize = "auto", triggerIconSize = "auto" }: TriggerProps) => (
    <DropdownButton
      style="ghost"
      size={triggerSize === "auto" ? triggerSizes[size] : triggerSize}
      text={text}
      icon={icon}
      iconSize={triggerIconSize === "xs" ? "xs" : undefined}
      isExpanded={isOpened}
      onClick={onClick}
    />
  );

const cellStyle = { minHeight: 190, display: "flex", flexDirection: "column", gap: 8 } as const;
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 } as const;
const captionStyle = { fontSize: 12, opacity: 0.6 } as const;

const Cell = ({ title, children }: { title: string; children: preact.ComponentChildren }) => (
  <div style={cellStyle}>
    <span style={captionStyle}>{title}</span>
    <div>{children}</div>
  </div>
);

type StoryMenuProps = ExtraArgs & {
  size?: "xs" | "s" | "m" | "l" | "xl";
  isInitialOpened?: boolean;
  placement?: "bottom-start" | "bottom-end";
  menuTrigger: (props: TriggerProps) => preact.VNode;
  children: preact.ComponentChildren;
};

// the menu of the stories follows the controls, it is remounted when they change, as the menu reads them only once
const StoryMenu = ({
  size = "xs",
  isInitialOpened = true,
  placement = "bottom-start",
  triggerSize,
  triggerIconSize,
  menuTrigger,
  children,
}: StoryMenuProps) => (
  <Menu
    key={`${isInitialOpened}-${placement}`}
    size={size}
    isInitialOpened={isInitialOpened}
    placement={placement}
    menuTrigger={(props) => menuTrigger({ ...props, size, triggerSize, triggerIconSize })}
  >
    {children}
  </Menu>
);

const openedArgs = {
  size: "xs",
  isInitialOpened: true,
  placement: "bottom-start",
  triggerSize: "auto",
  triggerIconSize: "auto",
} as const;
// the sizes are shown all at once, so the control of the size has no meaning there
const sizelessControls = { controls: { include: ["isInitialOpened", "placement", "triggerIconSize"] } };

export const SizesComparison: Story = {
  parameters: { layout: "padded", ...sizelessControls },
  args: openedArgs,
  render: (args) => (
    <div style={gridStyle}>
      {(["xs", "s", "m"] as const).map((size) => (
        <Cell key={size} title={`size="${size}"`}>
          <StoryMenu
            size={size}
            isInitialOpened={args.isInitialOpened}
            placement={args.placement}
            triggerSize={(args as ExtraArgs).triggerSize}
            triggerIconSize={(args as ExtraArgs).triggerIconSize}
            // @ts-ignore
            menuTrigger={trigger(`Menu ${size}`, allureIcons.reportLogo)}
          >
            <Menu.Section>
              <Menu.Item leadingIcon={allureIcons.lineChartsBarChartSquare} onClick={() => {}}>
                Graphs
              </Menu.Item>
              <Menu.Item leadingIcon={allureIcons.lineChartsTimeline} onClick={() => {}}>
                Timeline
              </Menu.Item>
              <Menu.ItemWithCheckmark
                leadingIcon={allureIcons.reportLogo}
                leadingIconFilled
                isChecked
                onClick={() => {}}
              >
                Report
              </Menu.ItemWithCheckmark>
            </Menu.Section>
          </StoryMenu>
        </Cell>
      ))}
    </div>
  ),
};

type SizeVariant = { title: string; triggerIcon?: string; items: preact.ComponentChildren };

const sizeVariants: SizeVariant[] = [
  {
    title: "Text only",
    items: (
      <>
        <Menu.Item onClick={() => {}}>Graphs</Menu.Item>
        <Menu.Item onClick={() => {}}>Timeline</Menu.Item>
        <Menu.Item onClick={() => {}}>Metrics</Menu.Item>
      </>
    ),
  },
  {
    title: "Line icons",
    triggerIcon: allureIcons.lineChartsBarChartSquare,
    items: (
      <>
        <Menu.Item leadingIcon={allureIcons.lineChartsBarChartSquare} onClick={() => {}}>
          Graphs
        </Menu.Item>
        <Menu.Item leadingIcon={allureIcons.lineChartsTimeline} onClick={() => {}}>
          Timeline
        </Menu.Item>
        <Menu.Item leadingIcon={allureIcons.lineDevCodeSquare} onClick={() => {}}>
          Metrics
        </Menu.Item>
      </>
    ),
  },
  {
    title: "Logos (the icons which fill the whole box)",
    triggerIcon: allureIcons.github,
    items: (
      <>
        <Menu.Item leadingIcon={allureIcons.github} leadingIconFilled onClick={() => {}}>
          GitHub
        </Menu.Item>
        <Menu.Item leadingIcon={allureIcons.gitlab} leadingIconFilled onClick={() => {}}>
          GitLab
        </Menu.Item>
        <Menu.Item leadingIcon={allureIcons.jenkins} leadingIconFilled onClick={() => {}}>
          Jenkins
        </Menu.Item>
      </>
    ),
  },
  {
    title: "Logo and line icons with a checkmark",
    triggerIcon: allureIcons.reportLogo,
    items: (
      <>
        <Menu.ItemWithCheckmark leadingIcon={allureIcons.reportLogo} leadingIconFilled isChecked onClick={() => {}}>
          Report
        </Menu.ItemWithCheckmark>
        <Menu.ItemWithCheckmark leadingIcon={allureIcons.lineChartsTimeline} isChecked={false} onClick={() => {}}>
          Timeline
        </Menu.ItemWithCheckmark>
        <Menu.ItemWithCheckmark leadingIcon={allureIcons.lineChartsBarChartSquare} isChecked={false} onClick={() => {}}>
          Graphs
        </Menu.ItemWithCheckmark>
      </>
    ),
  },
  {
    title: "Icons with a right slot (links on hover, a shortcut)",
    triggerIcon: allureIcons.github,
    items: (
      <>
        <Menu.Item
          leadingIcon={allureIcons.github}
          leadingIconFilled
          href="https://example.com/pull/1"
          rightSlot={externalLinkIcon}
          showRightSlotOnHover
        >
          Open PR
        </Menu.Item>
        <Menu.Item
          leadingIcon={allureIcons.lineDevDataflow3}
          href="https://example.com/tree/main"
          rightSlot={externalLinkIcon}
        >
          main
        </Menu.Item>
        <Menu.Item leadingIcon={allureIcons.lineGeneralCopy3} rightSlot={<span>⌘C</span>} onClick={() => {}}>
          Copy
        </Menu.Item>
      </>
    ),
  },
];

// every kind of the content of the items in every size of the menu
export const SizesWithIcons: Story = {
  parameters: { layout: "padded", ...sizelessControls },
  args: openedArgs,
  render: (args) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {sizeVariants.map((variant) => (
        <div key={variant.title}>
          <div style={{ ...captionStyle, marginBottom: 4 }}>{variant.title}</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            {(["xs", "s", "m"] as const).map((size) => (
              <div key={size} style={{ minHeight: 210 }}>
                <StoryMenu
                  size={size}
                  isInitialOpened={args.isInitialOpened}
                  placement={args.placement}
                  triggerSize={(args as ExtraArgs).triggerSize}
                  triggerIconSize={(args as ExtraArgs).triggerIconSize}
                  // @ts-ignore
                  menuTrigger={trigger(`size ${size}`, variant.triggerIcon)}
                >
                  <Menu.Section>{variant.items}</Menu.Section>
                </StoryMenu>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  ),
};

const triggerCombinations: { title: string; triggerSize: TriggerSize; triggerIconSize: TriggerIconSize }[] = [
  { title: "Button s, the icon of the button", triggerSize: "s", triggerIconSize: "auto" },
  { title: "Button m, a small icon (xs), as in the header of the report", triggerSize: "m", triggerIconSize: "xs" },
  { title: "Button m, the icon of the button", triggerSize: "m", triggerIconSize: "auto" },
  { title: "Button l, the icon of the button", triggerSize: "l", triggerIconSize: "auto" },
];

// the size of the button of the trigger (and of the icon in it) does not depend on the size of the menu:
// a small icon in the button can open the menu with the large icons and the other way round
export const IndependentSizes: Story = {
  parameters: { layout: "padded", controls: { include: ["isInitialOpened", "placement"] } },
  args: openedArgs,
  render: (args) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {triggerCombinations.map((combination) => (
        <div key={combination.title}>
          <div style={{ ...captionStyle, marginBottom: 4 }}>{combination.title}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {(["xs", "s", "m"] as const).map((size) => (
              <div key={size} style={{ minHeight: 210 }}>
                <StoryMenu
                  size={size}
                  isInitialOpened={args.isInitialOpened}
                  placement={args.placement}
                  triggerSize={combination.triggerSize}
                  triggerIconSize={combination.triggerIconSize}
                  menuTrigger={trigger(`menu ${size}`, allureIcons.reportLogo)}
                >
                  <Menu.Section>{sizeVariants[3].items}</Menu.Section>
                </StoryMenu>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  ),
};

export const CompactSectionPicker: Story = {
  args: openedArgs,
  render: (args) => (
    <div style={cellStyle}>
      <StoryMenu
        size={args.size}
        isInitialOpened={args.isInitialOpened}
        placement={args.placement}
        triggerSize={(args as ExtraArgs).triggerSize}
        triggerIconSize={(args as ExtraArgs).triggerIconSize}
        // @ts-ignore
        menuTrigger={({ onClick, isOpened }) => (
          <DropdownButton
            style="ghost"
            size="m"
            text="Report"
            icon={allureIcons.reportLogo}
            iconSize="xs"
            isExpanded={isOpened}
            onClick={onClick}
          />
        )}
      >
        <Menu.Section>
          <Menu.ItemWithCheckmark leadingIcon={allureIcons.reportLogo} leadingIconFilled isChecked onClick={() => {}}>
            Report
          </Menu.ItemWithCheckmark>
          <Menu.ItemWithCheckmark
            leadingIcon={allureIcons.lineChartsBarChartSquare}
            isChecked={false}
            onClick={() => {}}
          >
            Graphs
          </Menu.ItemWithCheckmark>
          <Menu.ItemWithCheckmark leadingIcon={allureIcons.lineChartsTimeline} isChecked={false} onClick={() => {}}>
            Timeline
          </Menu.ItemWithCheckmark>
          <Menu.ItemWithCheckmark
            leadingIcon={allureIcons.lineChartsBarChartSquare}
            isChecked={false}
            onClick={() => {}}
          >
            Metrics
          </Menu.ItemWithCheckmark>
        </Menu.Section>
      </StoryMenu>
    </div>
  ),
};

type GitInfoVariant = {
  title: string;
  trigger: { text: string; icon?: string };
  ci?: { icon?: string; filled?: boolean; label: string; href: string };
  branch?: { name: string; href?: string };
  commit?: { sha: string; href?: string };
};

const REPO = "https://example.com/allure-framework/allure3";
const SHA = "7978df3c8132d35f922679e1c72c4e3d26c95061";

const gitInfoVariants: GitInfoVariant[] = [
  {
    title: "Pull request, branch and commit, all are links",
    trigger: { text: "Pull request #123", icon: allureIcons.github },
    ci: { icon: allureIcons.github, filled: true, label: "Open PR", href: "https://example.com/pull/123" },
    branch: { name: "master", href: `${REPO}/tree/master` },
    commit: { sha: SHA, href: `${REPO}/commit/${SHA}` },
  },
  {
    title: "No pull request, only the job run",
    trigger: { text: "Nightly regression #812", icon: allureIcons.gitlab },
    ci: { icon: allureIcons.gitlab, filled: true, label: "Open job run", href: "https://example.com/run/812" },
    branch: { name: "release/3.x", href: `${REPO}/-/tree/release/3.x` },
    commit: { sha: SHA, href: `${REPO}/-/commit/${SHA}` },
  },
  {
    title: "No CI, git only, the repository is unknown (no links)",
    trigger: { text: "feature/header-rework" },
    branch: { name: "feature/header-rework" },
    commit: { sha: SHA },
  },
  {
    title: "CI without an icon (fallback icon of a link)",
    trigger: { text: "Local run" },
    ci: { icon: allureIcons.lineGeneralLink1, label: "Open job run", href: "https://example.com/run/1" },
    branch: { name: "main", href: `${REPO}/tree/main` },
    commit: { sha: SHA, href: `${REPO}/commit/${SHA}` },
  },
  {
    title: "A very long branch name",
    trigger: { text: "Pull request #4521", icon: allureIcons.github },
    ci: { icon: allureIcons.github, filled: true, label: "Open PR", href: "https://example.com/pull/4521" },
    branch: {
      name: "feature/ALLURE-123456-rework-of-the-header-breadcrumbs-for-the-deeply-nested-suites",
      href: `${REPO}/tree/feature/long`,
    },
    commit: { sha: SHA, href: `${REPO}/commit/${SHA}` },
  },
  {
    title: "Pull request and branch, the commit is unknown",
    trigger: { text: "Pull request #7", icon: allureIcons.github },
    ci: { icon: allureIcons.github, filled: true, label: "Open PR", href: "https://example.com/pull/7" },
    branch: { name: "fix/typo", href: `${REPO}/tree/fix/typo` },
  },
];

const GitInfoMenu = ({
  variant,
  ...menuProps
}: { variant: GitInfoVariant } & Omit<StoryMenuProps, "menuTrigger" | "children">) => (
  <StoryMenu
    {...menuProps}
    // @ts-ignore
    menuTrigger={({ onClick, isOpened }) => (
      // the same limit of the width as the trigger has in the header of the report
      <div style={{ display: "flex", maxWidth: "24ch" }}>
        <DropdownButton
          style="ghost"
          size="m"
          text={variant.trigger.text}
          icon={variant.trigger.icon}
          iconSize="xs"
          isExpanded={isOpened}
          isTextTruncated
          onClick={onClick}
        />
      </div>
    )}
  >
    <Menu.Section>
      {variant.ci && (
        <Menu.Item
          leadingIcon={variant.ci.icon}
          leadingIconFilled={variant.ci.filled}
          href={variant.ci.href}
          rightSlot={externalLinkIcon}
          showRightSlotOnHover
        >
          {variant.ci.label}
        </Menu.Item>
      )}
      {variant.branch && (
        <Menu.Item
          leadingIcon={allureIcons.lineDevDataflow3}
          href={variant.branch.href}
          copyValue={variant.branch.name}
          rightSlot={variant.branch.href ? externalLinkIcon : undefined}
          showRightSlotOnHover
        >
          <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {variant.branch.name}
          </span>
        </Menu.Item>
      )}
      {variant.commit && (
        <Menu.Item
          leadingIcon={allureIcons.lineDevCodeSquare}
          href={variant.commit.href}
          copyValue={variant.commit.sha}
          rightSlot={variant.commit.href ? externalLinkIcon : undefined}
          showRightSlotOnHover
        >
          <MiddleEllipsis text={variant.commit.sha} />
        </Menu.Item>
      )}
    </Menu.Section>
  </StoryMenu>
);

export const CompactGitInfoVariants: Story = {
  args: openedArgs,
  parameters: { layout: "padded" },
  render: (args) => (
    <div style={gridStyle}>
      {gitInfoVariants.map((variant) => (
        <Cell key={variant.title} title={variant.title}>
          <GitInfoMenu
            variant={variant}
            size={args.size}
            isInitialOpened={args.isInitialOpened}
            placement={args.placement}
            triggerSize={(args as ExtraArgs).triggerSize}
            triggerIconSize={(args as ExtraArgs).triggerIconSize}
          />
        </Cell>
      ))}
    </div>
  ),
};

// every type of the CI of the report, the way it is usually met: the pull request exists only in some of them,
// the links to the branch and the commit are built for GitHub, GitLab and Bitbucket repositories only
const gitInfoByCi: GitInfoVariant[] = [
  {
    title: "GitHub: pull request, links to the repository",
    trigger: { text: "Pull request #123", icon: allureIcons.github },
    ci: { icon: allureIcons.github, filled: true, label: "Open PR", href: "https://example.com/pull/123" },
    branch: { name: "deduplicate-report-generators", href: `${REPO}/tree/deduplicate-report-generators` },
    commit: {
      sha: "7978df3c8132d35f922679e1c72c4e3d26c95061",
      href: `${REPO}/commit/7978df3c8132d35f922679e1c72c4e3d26c95061`,
    },
  },
  {
    title: "GitLab: merge request, links to the repository",
    trigger: { text: "Merge request !58", icon: allureIcons.gitlab },
    ci: { icon: allureIcons.gitlab, filled: true, label: "Open PR", href: "https://example.com/mr/58" },
    branch: { name: "cleanup-classic-dependencies", href: `${REPO}/-/tree/cleanup-classic-dependencies` },
    commit: {
      sha: "0e439982439152586e01fc4a93e3092992722586",
      href: `${REPO}/-/commit/0e439982439152586e01fc4a93e3092992722586`,
    },
  },
  {
    title: "Bitbucket: pull request, links to the repository",
    trigger: { text: "Pull request #17", icon: allureIcons.bitbucket },
    ci: { icon: allureIcons.bitbucket, filled: true, label: "Open PR", href: "https://example.com/pr/17" },
    branch: { name: "fix/quality-gate-framework-retries", href: `${REPO}/branch/fix/quality-gate-framework-retries` },
    commit: {
      sha: "0bd671138752a4ae997137ab2991fdeb51596f1e",
      href: `${REPO}/commits/0bd671138752a4ae997137ab2991fdeb51596f1e`,
    },
  },
  {
    title: "Azure: pull request, the repository is not recognized (no links)",
    trigger: { text: "Pull request #204", icon: allureIcons.azure },
    ci: { icon: allureIcons.azure, filled: true, label: "Open PR", href: "https://example.com/azure/pr/204" },
    branch: { name: "feat/dynamic-environments" },
    commit: { sha: "dff0eadae24bb0217ca25cd9d126c9fa32db5411" },
  },
  {
    title: "CircleCI: workflow run, links to the repository",
    trigger: { text: "build-and-test #4812", icon: allureIcons.circleci },
    ci: { icon: allureIcons.circleci, filled: true, label: "Open job run", href: "https://example.com/circle/4812" },
    branch: { name: "vite-plus-tasks", href: `${REPO}/tree/vite-plus-tasks` },
    commit: {
      sha: "41e9cf422f3a2cd8687c268b4411e6d4599d58c5",
      href: `${REPO}/commit/41e9cf422f3a2cd8687c268b4411e6d4599d58c5`,
    },
  },
  {
    title: "Jenkins: build, no repository (no links)",
    trigger: { text: "nightly-regression #1337", icon: allureIcons.jenkins },
    ci: { icon: allureIcons.jenkins, filled: true, label: "Open job run", href: "https://example.com/jenkins/1337" },
    branch: { name: "main" },
    commit: { sha: "036a04e9a0bcca103dbf2b8d969b1c4cae688405" },
  },
  {
    title: "Drone: build, the repository is not recognized (no links)",
    trigger: { text: "Build #96", icon: allureIcons.drone },
    ci: { icon: allureIcons.drone, filled: true, label: "Open job run", href: "https://example.com/drone/96" },
    branch: { name: "dependabot/npm_and_yarn/i18next-26.4.3" },
    commit: { sha: "cc18b8f421d75b3a43815e3871ad7b7832ff0c39" },
  },
  {
    title: "Amazon CodeBuild: build, links to the repository",
    trigger: { text: "codebuild-project:7d1a", icon: allureIcons.amazon },
    ci: { icon: allureIcons.amazon, filled: true, label: "Open job run", href: "https://example.com/codebuild/7d1a" },
    branch: { name: "feat/gh-workflow-command", href: `${REPO}/tree/feat/gh-workflow-command` },
    commit: {
      sha: "f2be44e48ef9a61a88edc951b0061ecde2705c00",
      href: `${REPO}/commit/f2be44e48ef9a61a88edc951b0061ecde2705c00`,
    },
  },
  {
    title: "Local: no CI, only git",
    trigger: { text: "serve-no-open" },
    branch: { name: "serve-no-open" },
    commit: { sha: "fc0adc03f727d351c8b24707a8c9b3359c02b45b" },
  },
];

export const CompactGitInfoByCi: Story = {
  args: openedArgs,
  parameters: { layout: "padded" },
  render: (args) => (
    <div style={gridStyle}>
      {gitInfoByCi.map((variant) => (
        <Cell key={variant.title} title={variant.title}>
          <GitInfoMenu
            variant={variant}
            size={args.size}
            isInitialOpened={args.isInitialOpened}
            placement={args.placement}
            triggerSize={(args as ExtraArgs).triggerSize}
            triggerIconSize={(args as ExtraArgs).triggerIconSize}
          />
        </Cell>
      ))}
    </div>
  ),
};

const LONG_SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f901234567a1b2c3d4e5f60718293a4b5c";

// the long names and numbers: the button and the rows are truncated, the full values are shown in the tooltips of the real report
const gitInfoLongValues: GitInfoVariant[] = [
  {
    title: "A long name and a long number of the job run",
    trigger: { text: "nightly-regression-of-the-whole-product-suite #1234567890", icon: allureIcons.jenkins },
    ci: { icon: allureIcons.jenkins, filled: true, label: "Open job run", href: "https://example.com/run/1234567890" },
    branch: { name: "release/3.x", href: `${REPO}/tree/release/3.x` },
    commit: { sha: SHA, href: `${REPO}/commit/${SHA}` },
  },
  {
    title: "A long number and a long title of the pull request",
    trigger: {
      text: "Pull request #1234567890: rework of the header, the breadcrumbs and the pickers",
      icon: allureIcons.github,
    },
    ci: { icon: allureIcons.github, filled: true, label: "Open PR", href: "https://example.com/pull/1234567890" },
    branch: { name: "feature/header", href: `${REPO}/tree/feature/header` },
    commit: { sha: SHA, href: `${REPO}/commit/${SHA}` },
  },
  {
    title: "A branch name of one long word",
    trigger: { text: "Pull request #7", icon: allureIcons.github },
    ci: { icon: allureIcons.github, filled: true, label: "Open PR", href: "https://example.com/pull/7" },
    branch: {
      name: "ALLURE123456789012345678901234567890123456789012345678901234567890",
      href: `${REPO}/tree/long`,
    },
    commit: { sha: SHA, href: `${REPO}/commit/${SHA}` },
  },
  {
    title: "A branch name with many levels",
    trigger: { text: "Pull request #8", icon: allureIcons.github },
    ci: { icon: allureIcons.github, filled: true, label: "Open PR", href: "https://example.com/pull/8" },
    branch: {
      name: "users/someone/feature/ALLURE-123456/rework/of/the/header/and/breadcrumbs/for/nested/suites",
      href: `${REPO}/tree/long`,
    },
    commit: { sha: SHA, href: `${REPO}/commit/${SHA}` },
  },
  {
    title: "A long commit (SHA-256, 64 characters), the start and the end are shown",
    trigger: { text: "Pull request #9", icon: allureIcons.github },
    ci: { icon: allureIcons.github, filled: true, label: "Open PR", href: "https://example.com/pull/9" },
    branch: { name: "main", href: `${REPO}/tree/main` },
    commit: { sha: LONG_SHA, href: `${REPO}/commit/${LONG_SHA}` },
  },
  {
    title: "Everything is long at once, no links",
    trigger: { text: "Nightly regression of the whole product suite on all the browsers #1234567890" },
    branch: { name: "users/someone/feature/ALLURE-123456/rework/of/the/header/and/breadcrumbs/for/nested/suites" },
    commit: { sha: LONG_SHA },
  },
];

export const CompactGitInfoLongValues: Story = {
  args: openedArgs,
  parameters: { layout: "padded" },
  render: (args) => (
    <div style={gridStyle}>
      {gitInfoLongValues.map((variant) => (
        <Cell key={variant.title} title={variant.title}>
          <GitInfoMenu
            variant={variant}
            size={args.size}
            isInitialOpened={args.isInitialOpened}
            placement={args.placement}
            triggerSize={(args as ExtraArgs).triggerSize}
            triggerIconSize={(args as ExtraArgs).triggerIconSize}
          />
        </Cell>
      ))}
    </div>
  ),
};

export const LinkItemsOnHover: Story = {
  args: openedArgs,
  render: (args) => (
    <div style={cellStyle}>
      <StoryMenu
        size={args.size}
        isInitialOpened={args.isInitialOpened}
        placement={args.placement}
        triggerSize={(args as ExtraArgs).triggerSize}
        triggerIconSize={(args as ExtraArgs).triggerIconSize}
        // @ts-ignore
        menuTrigger={trigger("Links", allureIcons.github)}
      >
        <Menu.Section>
          <Menu.Item href="https://example.com/one" rightSlot={externalLinkIcon} showRightSlotOnHover>
            The icon appears on hover
          </Menu.Item>
          <Menu.Item href="https://example.com/two" rightSlot={externalLinkIcon}>
            The icon is always visible
          </Menu.Item>
          <Menu.Item>Plain text, not a link</Menu.Item>
          <Menu.Item onClick={() => alert("Clicked")}>A button</Menu.Item>
        </Menu.Section>
      </StoryMenu>
    </div>
  ),
};

export const CompactWithSections: Story = {
  args: openedArgs,
  render: (args) => (
    <div style={cellStyle}>
      <StoryMenu
        size={args.size}
        isInitialOpened={args.isInitialOpened}
        placement={args.placement}
        triggerSize={(args as ExtraArgs).triggerSize}
        triggerIconSize={(args as ExtraArgs).triggerIconSize}
        // @ts-ignore
        menuTrigger={trigger("Sections", allureIcons.reportLogo)}
      >
        <Menu.Section>
          <Menu.ItemWithCheckmark leadingIcon={allureIcons.reportLogo} leadingIconFilled isChecked onClick={() => {}}>
            Report
          </Menu.ItemWithCheckmark>
          <Menu.ItemWithCheckmark leadingIcon={allureIcons.lineChartsTimeline} isChecked={false} onClick={() => {}}>
            Timeline
          </Menu.ItemWithCheckmark>
        </Menu.Section>
        <Menu.Section>
          <Menu.Item leadingIcon={allureIcons.lineGeneralCopy3} onClick={() => {}}>
            Copy the link
          </Menu.Item>
          <Menu.Item leadingIcon={allureIcons.lineGeneralDownloadCloud} onClick={() => {}}>
            Download
          </Menu.Item>
        </Menu.Section>
      </StoryMenu>
    </div>
  ),
};

export const CompactManyItems: Story = {
  args: openedArgs,
  render: (args) => (
    <div style={{ ...cellStyle, minHeight: 420 }}>
      <StoryMenu
        size={args.size}
        isInitialOpened={args.isInitialOpened}
        placement={args.placement}
        triggerSize={(args as ExtraArgs).triggerSize}
        triggerIconSize={(args as ExtraArgs).triggerIconSize}
        // @ts-ignore
        menuTrigger={trigger("Many items (scrolls)", allureIcons.lineChartsTimeline)}
      >
        <Menu.Section>
          {Array.from({ length: 18 }, (_, index) => (
            <Menu.Item key={index} leadingIcon={allureIcons.lineChartsTimeline} onClick={() => {}}>
              Item {index + 1}
            </Menu.Item>
          ))}
        </Menu.Section>
      </StoryMenu>
    </div>
  ),
};

const truncated = { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;

export const CompactLongLabels: Story = {
  args: openedArgs,
  render: (args) => (
    <div style={gridStyle}>
      {[
        "Short",
        "A label which is a bit longer than the others",
        "A_very_long_identifier_without_any_spaces_that_does_not_fit_to_the_menu_at_all",
      ].map((label) => (
        <Cell key={label} title={label.length > 30 ? `${label.slice(0, 30)}…` : label}>
          <StoryMenu
            size={args.size}
            isInitialOpened={args.isInitialOpened}
            placement={args.placement}
            triggerSize={(args as ExtraArgs).triggerSize}
            triggerIconSize={(args as ExtraArgs).triggerIconSize}
            // @ts-ignore
            menuTrigger={trigger("Menu", allureIcons.lineDevDataflow3)}
          >
            <Menu.Section>
              <Menu.Item
                leadingIcon={allureIcons.lineDevDataflow3}
                href="https://example.com"
                rightSlot={externalLinkIcon}
                showRightSlotOnHover
              >
                <span style={truncated} title={label}>
                  {label}
                </span>
              </Menu.Item>
              <Menu.Item leadingIcon={allureIcons.lineDevCodeSquare} onClick={() => {}}>
                <span style={truncated}>{label}</span>
              </Menu.Item>
            </Menu.Section>
          </StoryMenu>
        </Cell>
      ))}
    </div>
  ),
};

export const LinksInAllSizes: Story = {
  parameters: sizelessControls,
  args: openedArgs,
  render: (args) => (
    <div style={gridStyle}>
      {(["xs", "s", "m", "l"] as const).map((size) => (
        <Cell key={size} title={`size="${size}"`}>
          <StoryMenu
            size={size}
            isInitialOpened={args.isInitialOpened}
            placement={args.placement}
            triggerSize={(args as ExtraArgs).triggerSize}
            triggerIconSize={(args as ExtraArgs).triggerIconSize}
            // @ts-ignore
            menuTrigger={trigger("Links", allureIcons.github)}
          >
            <Menu.Section>
              <Menu.Item
                leadingIcon={allureIcons.github}
                leadingIconFilled
                href="https://example.com/pull/1"
                rightSlot={externalLinkIcon}
              >
                Open PR
              </Menu.Item>
              <Menu.Item
                leadingIcon={allureIcons.lineDevDataflow3}
                href="https://example.com/tree/main"
                rightSlot={externalLinkIcon}
              >
                main
              </Menu.Item>
              <Menu.Item
                leadingIcon={allureIcons.lineDevCodeSquare}
                href="https://example.com/commit/0a1b2c3"
                rightSlot={externalLinkIcon}
              >
                0a1b2c3
              </Menu.Item>
            </Menu.Section>
          </StoryMenu>
        </Cell>
      ))}
    </div>
  ),
};
