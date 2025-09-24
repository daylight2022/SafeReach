module.exports = {
  presets: ['module:@react-native/babel-preset'],

  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: { '@': './src' },
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      },
    ],

    /* --- react-native-reanimated 必须放在最末尾（若用到）--- */
    'react-native-reanimated/plugin',
  ],
};