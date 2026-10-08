export const svgrOptions = {
  icon: true,
  svgoConfig: {
    plugins: [
      {
        name: "preset-default",
        params: {
          overrides: {
            removeViewBox: false,
            inlineStyles: {
              onlyMatchedOnce: false,
            },
          },
        },
      },
      "convertStyleToAttrs",
      "prefixIds",
    ],
  },
};
