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

## Styles 
Add styles to App.ts
```shell
import "@allurereport/web-components/index.css";
```

## Icon pack
```shell
import {  allureIcons } from "@allurereport/web-components";

# somewhere in .tsx file
{ allureIcons.reportLogo }
```
## Fonts
Allure use PTRootUI and JetBrainsMono fonts and can be imported from package:
```shell
import "@allurereport/web-components/fonts/pt-root-ui_vf.woff";
import "@allurereport/web-components/fonts/JetBrainsMono_vf.woff";
```
or if you use SASS:
```shell
@import "~@allurereport/web-components/mixins.scss";

@include allure-fonts;

```
