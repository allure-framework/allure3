import { TestResult } from '../../domain/entities/TestResult.js';
import { TestResultAggregator } from '../../domain/services/TestResultAggregator.js';
import type { TreeNode } from '../dto/responses/TreeResponse.js';

export class TreeService {
  private readonly aggregator: TestResultAggregator;

  constructor() {
    this.aggregator = new TestResultAggregator();
  }

  buildSuitesTree(results: ReadonlyArray<TestResult>): TreeNode {
    const parentSuiteGrouped = this.aggregator.groupByLabel(results, 'parentSuite');
    const hasParentSuite = parentSuiteGrouped.size > 0 && (parentSuiteGrouped.size > 1 || !parentSuiteGrouped.has('__no_label__'));

    if (hasParentSuite) {
      return this.buildSuitesTreeWithParentSuite(results, parentSuiteGrouped);
    }

    return this.buildSuitesTreeFlat(results);
  }

  private buildSuitesTreeWithParentSuite(
    results: ReadonlyArray<TestResult>,
    parentSuiteGrouped: Map<string, TestResult[]>
  ): TreeNode {
    const parentSuiteNames = Array.from(parentSuiteGrouped.keys()).filter((k) => k !== '__no_label__');
    const singleParentSuite = parentSuiteNames.length === 1 ? parentSuiteNames[0]! : null;

    const root: TreeNode = {
      name: singleParentSuite ?? 'Suites',
      children: []
    };

    for (const [parentSuiteName, parentSuiteResults] of parentSuiteGrouped.entries()) {
      const displayParentName = parentSuiteName === '__no_label__' ? 'Tests' : parentSuiteName;
      const suiteGrouped = this.aggregator.groupByLabel(parentSuiteResults, 'suite');

      if (singleParentSuite && parentSuiteName === singleParentSuite) {
        // Flatten: put suite nodes directly under root
        for (const [suiteName, suiteResults] of suiteGrouped.entries()) {
          const isNoLabel = suiteName === '__no_label__';
          const displaySuiteName = isNoLabel ? 'Tests' : suiteName;
          const suiteNode = this.buildSuiteNode(suiteResults, displaySuiteName);
          root.children!.push(suiteNode);
        }
      } else {
        // Multiple parentSuites: add parentSuite as intermediate level
        const parentNode: TreeNode = {
          name: displayParentName,
          children: [],
          statistic: this.aggregator.calculateStatistic(parentSuiteResults)
        };
        for (const [suiteName, suiteResults] of suiteGrouped.entries()) {
          const isNoLabel = suiteName === '__no_label__';
          const displaySuiteName = isNoLabel ? 'Tests' : suiteName;
          const suiteNode = this.buildSuiteNode(suiteResults, displaySuiteName);
          parentNode.children!.push(suiteNode);
        }
        root.children!.push(parentNode);
      }
    }

    root.statistic = this.aggregator.calculateStatistic(results);
    return root;
  }

  private buildSuitesTreeFlat(results: ReadonlyArray<TestResult>): TreeNode {
    const grouped = this.aggregator.groupByLabel(results, 'suite');
    const root: TreeNode = {
      name: 'Suites',
      children: []
    };

    for (const [suiteName, suiteResults] of grouped.entries()) {
      const isNoLabel = suiteName === '__no_label__';
      const displayName = isNoLabel ? 'Tests' : suiteName;
      const suiteNode = this.buildSuiteNode(suiteResults, displayName);
      root.children!.push(suiteNode);
    }

    root.statistic = this.aggregator.calculateStatistic(results);
    return root;
  }

  private buildSuiteNode(suiteResults: TestResult[], displayName: string): TreeNode {
    const suiteNode: TreeNode = {
      name: displayName,
      children: [],
      statistic: this.aggregator.calculateStatistic(suiteResults)
    };

    const classGrouped = this.aggregator.groupByLabel(suiteResults, 'testClass');
    for (const [className, classResults] of classGrouped.entries()) {
      if (className === '__no_label__') {
        for (const result of classResults) {
          const duration = result.getTimeRange().getDuration();
          suiteNode.children!.push(this.buildLeafNode(result, duration));
        }
      } else {
        const classNode: TreeNode = {
          name: className,
          children: classResults.map((result) => this.buildLeafNode(result, result.getTimeRange().getDuration())),
          statistic: this.aggregator.calculateStatistic(classResults)
        };
        suiteNode.children!.push(classNode);
      }
    }

    return suiteNode;
  }

  private buildLeafNode(result: TestResult, duration: number | null | undefined): TreeNode {
    const tags = result
      .findLabelsByName('tag')
      .map((l) => l.getValue())
      .filter((v): v is string => v != null && v !== '');
    return {
      name: result.getName().getValue(),
      uid: result.getId().getValue(),
      duration: duration ?? undefined,
      tags: tags.length > 0 ? tags : undefined,
      statistic: {
        total: 1,
        [result.getStatus().getValue()]: 1
      }
    };
  }

  buildPackagesTree(results: ReadonlyArray<TestResult>): TreeNode {
    const grouped = this.aggregator.groupByLabel(results, 'package');
    const root: TreeNode = {
      name: 'Packages',
      children: []
    };

    for (const [packageName, packageResults] of grouped.entries()) {
      const isNoLabel = packageName === '__no_label__';
      const displayName = isNoLabel ? 'Tests' : packageName;

      const packageNode: TreeNode = {
        name: displayName,
        children: packageResults.map((result) =>
          this.buildLeafNode(result, result.getTimeRange().getDuration())
        ),
        statistic: this.aggregator.calculateStatistic(packageResults)
      };

      root.children!.push(packageNode);
    }

    root.statistic = this.aggregator.calculateStatistic(results);
    return root;
  }

  buildBehaviorsTree(results: ReadonlyArray<TestResult>): TreeNode {
    const grouped = this.aggregator.groupByLabel(results, 'epic');
    const root: TreeNode = {
      name: 'Behaviors',
      children: []
    };

    for (const [epicName, epicResults] of grouped.entries()) {
      const isNoLabel = epicName === '__no_label__';
      const displayName = isNoLabel ? 'Tests' : epicName;

      const storyGrouped = this.aggregator.groupByLabel(epicResults, 'story');
      const epicNode: TreeNode = {
        name: displayName,
        children: [],
        statistic: this.aggregator.calculateStatistic(epicResults)
      };

      for (const [storyName, storyResults] of storyGrouped.entries()) {
        const isStoryNoLabel = storyName === '__no_label__';
        const storyDisplayName = isStoryNoLabel ? displayName : storyName;

        const storyNode: TreeNode = {
          name: storyDisplayName,
          children: storyResults.map((result) =>
            this.buildLeafNode(result, result.getTimeRange().getDuration())
          ),
          statistic: this.aggregator.calculateStatistic(storyResults)
        };

        epicNode.children!.push(storyNode);
      }

      root.children!.push(epicNode);
    }

    root.statistic = this.aggregator.calculateStatistic(results);
    return root;
  }

  /** Same structure as behaviors (epic/story) but with root name "Categories" for the Categories tab. */
  buildCategoriesTree(results: ReadonlyArray<TestResult>): TreeNode {
    const root = this.buildBehaviorsTree(results);
    root.name = 'Categories';
    return root;
  }
}
