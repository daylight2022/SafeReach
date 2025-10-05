// API 配置文件
// 根据环境自动选择 API 基础 URL

// 开发环境配置
const DEV_CONFIG = {
  API_BASE_URL: 'http://1.12.60.17:3000/api', // 局域网开发环境
  // API_BASE_URL: 'http://192.168.18.235:3000/api', // 局域网开发环境
};

// 生产环境配置
const PROD_CONFIG = {
  API_BASE_URL: 'http://1.12.60.17:3000/api', // 生产环境 API
};

// 根据环境变量或调试模式选择配置
const isDevelopment = __DEV__;

export const API_CONFIG = isDevelopment ? DEV_CONFIG : PROD_CONFIG;

// 导出常用配置
export const { API_BASE_URL } = API_CONFIG;

// 网络超时配置
export const NETWORK_CONFIG = {
  TIMEOUT: 10000, // 10秒超时
  RETRY_ATTEMPTS: 3, // 重试次数
  RETRY_DELAY: 1000, // 重试延迟（毫秒）
};
