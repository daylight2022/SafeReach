const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const defaultConfig = getDefaultConfig(__dirname);

/**
 * 通用 Metro 配置（RN ≥ 0.72）
 * 复制本文件即可支持「路径别名 / 大文件 / 软链 / 单仓库」
 */
const config = {
  resolver: {
    ...defaultConfig.resolver,

    /* 1. 同步 Babel 别名 → Metro，防止「找不到模块」红屏 */
    extraNodeModules: {
      '@': path.resolve(__dirname, 'src'),
    },

    /* 2. 支持软链（monorepo 必备）*/
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      // 若用 workspaces 再补一行上级 node_modules
      // path.resolve(__dirname, '../../node_modules'),
    ],

    /* 3. 放宽 asset 限制，允许 1 MB+ 字体/视频 */
    assetExts: defaultConfig.resolver.assetExts.filter(ext => ext !== 'svg'),
    sourceExts: [...defaultConfig.resolver.sourceExts, 'svg'], // 如需 react-native-svg-transformer
  },

  /* 4. 加速：开启「持久化缓存」+「并行 Worker」*/
  cacheStores: defaultConfig.cacheStores,
  maxWorkers: 2, // 2 核够用，4 核可改成 4
};

module.exports = mergeConfig(defaultConfig, config);