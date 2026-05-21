# Allure Web Components

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

## Overview

The package includes Design System Components which are used in web-implementations of Allure reports and Storybook.

## Install

Use your favorite package manager to install the package:

```shell
npm add @allurereport/web-components
yarn add @allurereport/web-components
pnpm add @allurereport/web-components
```

## Usage

### Styles 

Import styles right in your JavaScript or TypeScript file:

```ts
import "@allurereport/web-components/index.css";
```

Theme token guidance lives in [docs/theme.md](docs/theme.md). Component styles should use semantic
tokens such as `--color-status-failed-bg` and `--color-intent-danger-text`, not raw palette or legacy
support tokens.

### Icon pack

Use `allureIcons` object to get available SVG icons (see entire list of the icons [here](src/assets/svg/)):

```tsx
import { SvgIcon, allureIcons } from "@allurereport/web-components";

// somewhere in .tsx file
<SvgIcon id={allureIcons.reportLogo} />
```

### Fonts

Allure Report use `PTRootUI` and `JetBrainsMono` fonts which can be imported from package:

```ts
import "@allurereport/web-components/fonts/pt-root-ui_vf.woff";
import "@allurereport/web-components/fonts/JetBrainsMono_vf.woff";
```

Or if you use SASS:

```scss
@import "~@allurereport/web-components/mixins.scss";
@include allure-fonts;
```
