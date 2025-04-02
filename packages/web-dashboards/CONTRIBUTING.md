# Contributing

## Development

If you want to develop the report directly, using webpack with hot module replacement feature, follow the next steps:

### 1. Install the dependencies:

```bash
$ yarn install
```

### 2. Copy generated Allure Dashboards data files

Copy `data` and `widgets` directories from the previously generated Allure Dashboards report to `out/dev` directory.

If you don't have one, you can generate Allure Dashboards report in the sandbox package:

```bash
# cd to the web-dashboards package
cd packages/web-dashboards
mkdir -p out/dev
cp -rf ../sandbox/allure-report/dashboards/data out/dev
cp -rf ../sandbox/allure-report/dashboards/widgets out/dev
```

### 3. Run dev script

```bash
yarn workspace @allurereport/web-dashboards dev
```

Open the started report in the browser: http://localhost:8080.
