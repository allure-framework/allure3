export default class ExpressionPlugin {
  static configExpressions = {
    filter: "testFilter",
    sections: {
      items: {
        title: "name",
        fields: { items: { header: "name" } },
      },
    },
  };

  constructor(options) {
    this.options = options;
  }
}
