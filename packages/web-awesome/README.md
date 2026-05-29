# Web Allure Awesome

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

## Overview

Allure Awesome report web-implementation.

The package is utilized by Awesome Plugin.

## Install

Use your favorite package manager to install the package:

```shell
npm add @allurereport/web-awesome
yarn add @allurereport/web-awesome
pnpm add @allurereport/web-awesome
```

## Keyboard navigation

The Awesome report UI supports keyboard-driven navigation in three complementary styles. You can mix them: the same action is often bound to both **arrow keys** and **vim-style** keys where it makes sense.

| Style | Idea | Typical keys |
| --- | --- | --- |
| **Arrow keys** | Familiar directional navigation (editors, file dialogs) | `↑` `↓` `←` `→` |
| **Vim-like** | Horizontal/vertical movement on the home row | `j` `k` `h` `l`, `o`, `u` / `p` |
| **NerdTree-like** | Tree-focused workflow (expand/collapse, open node, jump to ends) | `j` `k` `h` `l`, `o`, `Space`, `Enter`, `g` / `G`, `-` / `+`, `C` / `A` |

Press **`?`** (Shift + `/`) anywhere in the report to open the shortcuts panel. It lists bindings for the active pane (tree vs test result).

Hotkeys are disabled while focus is in a text field (search, inputs). **`Esc`** closes the help panel or blurs search.

### Layout and focus

| Key | Scope | Action |
| --- | --- | --- |
| `?` | Global | Toggle shortcuts help |
| `s` | Global | Focus search |
| `Esc` | Global | Blur search / close help |
| `[` | Global | Focus **tree** pane (split layout) |
| `]` | Global | Focus **test result** pane (split layout) |
| `Shift+L` | Global | Toggle split / single-pane layout |
| `Ctrl/Cmd+\` | Global | Toggle layout (alternative) |
| `1`–`5` | Global | Report tabs: Results, Categories, Quality Gate, Global Attachments, Global Errors |
| `Tab` / `Shift+Tab` | Global | Next / previous report tab |

In **split layout**, tree and test-result bindings apply only to the **focused** pane. Click a pane or use `[` / `]` to switch focus.

### Tree pane (Results tab)

Available when the test tree is visible: full-page Results, or the **left pane** in split layout with tree focus.

**NerdTree-like + vim-like + arrows** all apply to the same tree:

| Action | Arrows | Vim / NerdTree |
| --- | --- | --- |
| Move focus up / down | `↑` / `↓` | `k` / `j` |
| Collapse / go to parent | `←` | `h`, `-` |
| Expand / first child | `→` | `l`, `+` |
| Parent node | — | `p`, `u` |
| Open test / toggle group | — | `o`, `Space` |
| Open focused test | — | `Enter` |
| First / last test | — | `g` then `g`, `G` |
| List scroll to top (Variables, filters, env) | `Home` | `g` `g`, `z` then `t` |
| Collapse / expand all children | — | `C`, `A` |
| Subtree expand/collapse (header chevron button) | — | `>` (cycle like the button) |
| Subtree: collapse all / first level / expand all | — | `Shift+C`, `f`, `Shift+A` |

**Report header blocks** (above the tree, per environment):

| Key | Section |
| --- | --- |
| `V` | **Variables** — show / hide |
| `M` | **Metadata** (OS, Node version, …) — show / hide |

These toggles do not move keyboard focus; they only expand or collapse the block.

When focus moves outside the visible area, the scroll container adjusts automatically: **test rows** (leaves) scroll to the **center** of the pane; **group / environment** headers scroll to the **top**. If the row is already fully visible, the scroll position does not change.

`Home`, `g` `g`, and `z` `t` also reset the list scroll to the **very top** of the pane so **Variables**, **Metadata**, and filters stay visible (not only the first tree row).

### Test result pane

Active when a test is open: full-page test view, or the **right pane** in split layout with test-result focus.

#### Between tests and tabs

| Key | Action |
| --- | --- |
| `n` / `N` | Next / previous test in the list |
| `1`–`5` | Tabs: Overview, History, Retries, Attachments, Environments |
| `Tab` / `Shift+Tab` | Next / previous tab |
| `Esc` | Back to tree (split: focus tree; single pane: return to list) |

#### Overview tab — execution blocks (Setup, Steps, Teardown)

Keyboard focus moves only through **execution** blocks (setup, step tree, teardown, nested steps and attachments). **Parameters**, **Labels**, and **Links** are not in this list; use the toggle keys below.

| Action | Arrows | Vim |
| --- | --- | --- |
| Next / previous block | `↓` / `↑` | `j` / `k` |
| Collapse (parent / close) | `←` | `h` |
| Expand / first child | — | `l`, `=` |
| Expand / collapse spoiler or attachment | `→` | `o` |
| Parent block | — | `p`, `u` |
| Toggle expand | — | `Space` |
| Subtree chevron (cycle like tree button) | — | `>` |

Same vim keys as the test tree where applicable (`j`/`k`/`h`/`l`/`p`/`u`/`o`, `>` for step subtree).

**Overview metadata** (collapsible sections, no `j`/`k` focus; use Shift so keys do not clash with step navigation):

| Key | Section |
| --- | --- |
| `Shift+L` | Labels |
| `Shift+P` | Parameters |
| `Shift+I` | Links |

Attachments expand **inline** with `o` or `→` (not fullscreen). The expand button in the row still opens fullscreen preview for images when needed.

#### Other test-result tabs

History, Retries, Attachments, and Environments tabs use tab switching (`1`–`5`, `Tab`) and `n` / `N`; step-tree navigation applies only on **Overview**.

### Where navigation does not apply

- **Categories**, **Quality Gate**, **Global Attachments**, **Global Errors** report tabs: use global tab keys (`1`–`5`, `Tab`), not the test tree.
- **Non-Results** views: no test-tree `j`/`k` focus.
- **Metadata toggles** (Labels, Parameters, Links, Variables, report Metadata): hotkeys only toggle visibility, no arrow focus ring.
