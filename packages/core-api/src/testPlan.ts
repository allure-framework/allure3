export interface TestPlanTest {
  id?: string;
  selector?: string;
}

export interface TestPlan {
  version: "1.0";
  tests: TestPlanTest[];
  mutedTests: TestPlanTest[];
}
