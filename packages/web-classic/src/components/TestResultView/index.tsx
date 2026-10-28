import { Loadable, PageLoader } from "@allurereport/web-components";
import { useEffect } from "preact/hooks";

import TestResult from "@/components/TestResult";
import TestResultEmpty from "@/components/TestResult/TestResultEmpty";
import { route } from "@/stores/router";
import { fetchTestResult, testResultStore } from "@/stores/testResults";

export const TestResultView = () => {
  const { params } = route.value;
  const { id: testResultId } = params;

  useEffect(() => {
    if (testResultId) fetchTestResult(testResultId);
  }, []);

  return (
    <Loadable
      source={testResultStore}
      renderLoader={() => <PageLoader />}
      transformData={(data) => (testResultId ? data[testResultId] : undefined)}
      renderError={() => <TestResultEmpty />}
      renderData={(testResultItem) => (
        <>
          <div key={testResultId}>
            <TestResult testResult={testResultItem} />
          </div>
        </>
      )}
    />
  );
};
