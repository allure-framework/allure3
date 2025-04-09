# Contributing

## Development

If you want to develop the report directly, using webpack with hot module replacement feature, follow the next steps:

### 1. Install the dependencies:

```bash
$ yarn install
```

### 2. Copy generated Allure Dashboard data files

Copy `data` and `widgets` directories from the previously generated Allure Dashboard report to `out/dev` directory.

If you don't have one, you can generate Allure Dashboard report in the sandbox package:

```bash
# cd to the web-dashboard package
cd packages/web-dashboard
mkdir -p out/dev
cp -rf ../sandbox/allure-report/dashboard/data out/dev
cp -rf ../sandbox/allure-report/dashboard/widgets out/dev
```

### 3. Run dev script

```bash
yarn workspace @allurereport/web-dashboard dev
```

Open the started report in the browser: http://localhost:8080.
