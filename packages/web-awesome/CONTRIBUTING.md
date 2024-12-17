# Contributing

## Development

If you want to develop the report directly, using webpack with hot module replacement feature, follow the next steps:

### 1. Install the dependencies:

```bash
$ yarn install
```

### 2. Copy generated Allure Awesome data files

Copy `data` and `widgets` directories from the previously generated Allure Awesome report to `out/dev` directory.

If you don't have one, you can generate Allure Awesome report in the sandbox package:

```bash
# cd to the web-awesome package
yarn workspace @allurereport/sandbox t
yarn workspace @allurereport/sandbox report
mkdir -p out/dev
cp -rf ../sandbox/allure-report/awesome/data out/dev
cp -rf ../sandbox/allure-report/awesome/widgets out/dev  
```

### 3. Run dev script

```bash
yarn workspace @allurereport/web-awesome dev
```

Open the started report in the browser: http://localhost:8080.
