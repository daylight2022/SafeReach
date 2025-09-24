import DeviceInfo from 'react-native-device-info';
import { apiClient, ApiResponse } from './api';

// 版本信息类型
export interface AppVersion {
  id: string;
  version: string;
  versionCode: number;
  releaseNotes: string;
  downloadUrl?: string;
  isPrerelease: boolean;
  isActive: boolean;
  releaseDate: string;
  createdAt: string;
  updatedAt: string;
}

// 版本检查结果类型
export interface VersionCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  currentVersionCode: number;
  latestVersion?: AppVersion;
  message: string;
}

// 版本历史响应类型
export interface VersionHistoryResponse {
  versions: AppVersion[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class VersionService {
  private currentVersion: string = '';
  private currentVersionCode: number = 0;

  constructor() {
    this.initializeVersionInfo();
  }

  // 初始化版本信息
  private async initializeVersionInfo() {
    try {
      this.currentVersion = DeviceInfo.getVersion();
      const buildNumber = await DeviceInfo.getBuildNumber();
      this.currentVersionCode =
        parseInt(buildNumber, 10) ||
        this.parseVersionToCode(this.currentVersion);
      console.log('当前版本信息:', {
        version: this.currentVersion,
        versionCode: this.currentVersionCode,
      });
    } catch (error) {
      console.error('获取版本信息失败:', error);
      // 设置默认值
      this.currentVersion = '0.0.1';
      this.currentVersionCode = 1;
    }
  }

  // 获取当前版本信息
  getCurrentVersion(): { version: string; versionCode: number } {
    return {
      version: this.currentVersion,
      versionCode: this.currentVersionCode,
    };
  }

  // 获取最新版本信息
  async getLatestVersion(): Promise<ApiResponse<AppVersion>> {
    try {
      // 使用公开接口，无需认证
      const response = await fetch(
        `${apiClient.getBaseUrl()}/versions/latest`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('获取最新版本失败:', error);
      return {
        success: false,
        message: '获取最新版本失败',
      };
    }
  }

  // 检查版本更新
  async checkForUpdates(): Promise<ApiResponse<VersionCheckResult>> {
    try {
      // 确保版本信息已初始化
      if (!this.currentVersion || !this.currentVersionCode) {
        await this.initializeVersionInfo();
      }

      const response = await fetch(
        `${apiClient.getBaseUrl()}/versions/check?version=${
          this.currentVersion
        }&versionCode=${this.currentVersionCode}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('检查版本更新失败:', error);
      return {
        success: false,
        message: '检查版本更新失败',
      };
    }
  }

  // 获取版本历史
  async getVersionHistory(
    page: number = 1,
    limit: number = 10,
    includePrerelease: boolean = false,
  ): Promise<ApiResponse<VersionHistoryResponse>> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        includePrerelease: includePrerelease.toString(),
      });

      const response = await fetch(
        `${apiClient.getBaseUrl()}/versions/history?${params}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('获取版本历史失败:', error);
      return {
        success: false,
        message: '获取版本历史失败',
      };
    }
  }

  // 比较版本号
  compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    const maxLength = Math.max(v1Parts.length, v2Parts.length);

    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }

    return 0;
  }

  // 解析版本号为版本代码（用于比较）
  parseVersionToCode(version: string): number {
    const parts = version.split('.').map(Number);
    const major = parts[0] || 0;
    const minor = parts[1] || 0;
    const patch = parts[2] || 0;

    // 使用简单的版本代码计算：major * 10000 + minor * 100 + patch
    return major * 10000 + minor * 100 + patch;
  }

  // 格式化版本号（确保三位数格式）
  formatVersion(version: string): string {
    const parts = version.split('.');
    while (parts.length < 3) {
      parts.push('0');
    }
    return parts.slice(0, 3).join('.');
  }

  // 检查是否需要强制更新（可以根据业务需求扩展）
  isForceUpdateRequired(
    currentVersionCode: number,
    latestVersionCode: number,
  ): boolean {
    // 示例：如果版本差距超过100（即主版本号差距超过1），则强制更新
    return latestVersionCode - currentVersionCode >= 10000;
  }

  // 获取更新类型
  getUpdateType(
    currentVersion: string,
    latestVersion: string,
  ): 'major' | 'minor' | 'patch' | 'none' {
    const currentParts = currentVersion.split('.').map(Number);
    const latestParts = latestVersion.split('.').map(Number);

    if (latestParts[0] > currentParts[0]) return 'major';
    if (latestParts[1] > currentParts[1]) return 'minor';
    if (latestParts[2] > currentParts[2]) return 'patch';

    return 'none';
  }
}

// 创建单例实例
export const versionService = new VersionService();

// 导出类型和服务
export default versionService;
