import { VersionUtils, getAppVersion, getAppVersionWithPrefix } from '../version';

// Mock react-native-device-info
jest.mock('react-native-device-info', () => ({
  getVersion: jest.fn(() => '1.1.0'),
  getBuildNumber: jest.fn(() => Promise.resolve('2')),
}));

describe('VersionUtils', () => {
  beforeEach(() => {
    // 重置缓存
    VersionUtils.resetCache();
  });

  describe('getVersion', () => {
    it('should return version from DeviceInfo', () => {
      const version = VersionUtils.getVersion();
      expect(version).toBe('1.1.0');
    });

    it('should cache version after first call', () => {
      const DeviceInfo = require('react-native-device-info');
      const spy = jest.spyOn(DeviceInfo, 'getVersion');
      
      VersionUtils.getVersion();
      VersionUtils.getVersion();
      
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getVersionWithPrefix', () => {
    it('should return version with v prefix', () => {
      const version = VersionUtils.getVersionWithPrefix();
      expect(version).toBe('v1.1.0');
    });

    it('should not add prefix if already present', () => {
      const DeviceInfo = require('react-native-device-info');
      DeviceInfo.getVersion.mockReturnValueOnce('v1.1.0');
      VersionUtils.resetCache();
      
      const version = VersionUtils.getVersionWithPrefix();
      expect(version).toBe('v1.1.0');
    });
  });

  describe('getBuildNumber', () => {
    it('should return build number from DeviceInfo', async () => {
      const buildNumber = await VersionUtils.getBuildNumber();
      expect(buildNumber).toBe('2');
    });
  });

  describe('getFullVersionInfo', () => {
    it('should return complete version information', async () => {
      const versionInfo = await VersionUtils.getFullVersionInfo();
      
      expect(versionInfo).toEqual({
        version: '1.1.0',
        versionWithPrefix: 'v1.1.0',
        buildNumber: '2',
      });
    });
  });

  describe('convenience functions', () => {
    it('getAppVersion should work', () => {
      expect(getAppVersion()).toBe('1.1.0');
    });

    it('getAppVersionWithPrefix should work', () => {
      expect(getAppVersionWithPrefix()).toBe('v1.1.0');
    });
  });

  describe('error handling', () => {
    it('should handle DeviceInfo.getVersion error', () => {
      const DeviceInfo = require('react-native-device-info');
      DeviceInfo.getVersion.mockImplementationOnce(() => {
        throw new Error('DeviceInfo error');
      });
      VersionUtils.resetCache();
      
      const version = VersionUtils.getVersion();
      expect(version).toBe('1.0.0'); // 默认版本
    });

    it('should handle DeviceInfo.getBuildNumber error', async () => {
      const DeviceInfo = require('react-native-device-info');
      DeviceInfo.getBuildNumber.mockRejectedValueOnce(new Error('DeviceInfo error'));
      VersionUtils.resetCache();
      
      const buildNumber = await VersionUtils.getBuildNumber();
      expect(buildNumber).toBe('1'); // 默认构建号
    });
  });
});
