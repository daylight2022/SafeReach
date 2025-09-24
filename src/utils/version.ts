import DeviceInfo from 'react-native-device-info';

/**
 * 版本信息工具函数
 * 从Android的build.gradle中获取versionName
 */
export class VersionUtils {
  private static version: string | null = null;
  private static buildNumber: string | null = null;

  /**
   * 获取应用版本号（从Android的versionName）
   * @returns 版本号字符串，如 "1.1.0"
   */
  static getVersion(): string {
    if (this.version === null) {
      try {
        this.version = DeviceInfo.getVersion();
      } catch (error) {
        console.error('获取版本号失败:', error);
        this.version = '1.0.0'; // 默认版本
      }
    }
    return this.version;
  }

  /**
   * 获取带v前缀的版本号
   * @returns 版本号字符串，如 "v1.1.0"
   */
  static getVersionWithPrefix(): string {
    const version = this.getVersion();
    return version.startsWith('v') ? version : `v${version}`;
  }

  /**
   * 获取构建号（从Android的versionCode）
   * @returns 构建号字符串
   */
  static async getBuildNumber(): Promise<string> {
    if (this.buildNumber === null) {
      try {
        this.buildNumber = await DeviceInfo.getBuildNumber();
      } catch (error) {
        console.error('获取构建号失败:', error);
        this.buildNumber = '1'; // 默认构建号
      }
    }
    return this.buildNumber;
  }

  /**
   * 获取完整的版本信息
   * @returns 包含版本号和构建号的对象
   */
  static async getFullVersionInfo(): Promise<{
    version: string;
    versionWithPrefix: string;
    buildNumber: string;
  }> {
    const version = this.getVersion();
    const buildNumber = await this.getBuildNumber();
    
    return {
      version,
      versionWithPrefix: this.getVersionWithPrefix(),
      buildNumber,
    };
  }

  /**
   * 重置缓存的版本信息（用于测试或强制刷新）
   */
  static resetCache(): void {
    this.version = null;
    this.buildNumber = null;
  }
}

/**
 * 便捷的导出函数
 */
export const getAppVersion = () => VersionUtils.getVersion();
export const getAppVersionWithPrefix = () => VersionUtils.getVersionWithPrefix();
export const getAppBuildNumber = () => VersionUtils.getBuildNumber();
export const getFullVersionInfo = () => VersionUtils.getFullVersionInfo();
