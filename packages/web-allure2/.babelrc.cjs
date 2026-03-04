module.exports = (api) => {
  api.cache(() => process.env.NODE_ENV);

  const presets = [
    "@babel/preset-env"
  ];
  const plugins = [
    ["@babel/plugin-proposal-decorators", { legacy: true }],
    "@babel/plugin-transform-class-properties",
    "@babel/plugin-transform-object-rest-spread",
    "@babel/plugin-transform-runtime",
  ];

  return {
    presets,
    plugins,
  };
};
