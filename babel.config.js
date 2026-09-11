module.exports = function (api) {
  api.cache(true);
  const isTest = process.env.NODE_ENV === 'test';

  // The critical fix for WatermelonDB sync on web:
  // We disable the built-in decorator transform in babel-preset-expo
  // and manually add the plugins in the required order.
  const expoPresetOptions = {
    decorators: false,
    ...(isTest ? {} : { jsxImportSource: 'nativewind' }),
  };

  return {
    presets: [
      ['babel-preset-expo', expoPresetOptions],
      !isTest && 'nativewind/babel',
    ].filter(Boolean),
    plugins: [
      'babel-plugin-transform-typescript-metadata',
      ['@babel/plugin-transform-typescript', { isTSX: true, allExtensions: true }],
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      ['@babel/plugin-transform-class-properties', { loose: true }],
      ['@babel/plugin-transform-private-methods', { loose: true }],
      ['@babel/plugin-transform-private-property-in-object', { loose: true }],
      'react-native-reanimated/plugin',
    ],
    env: {
      test: {
        plugins: [],
      },
    },
  };
};
