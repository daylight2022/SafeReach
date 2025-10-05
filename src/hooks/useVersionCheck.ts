import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { MMKV } from 'react-native-mmkv';
import { AppVersion, VersionCheckResult } from '@/services/versionService';
import { apiServices } from '@/services/apiServices';

// 创建存储实例
const storage = new MMKV({
  id: 'version-check',
  encryptionKey: 'SafeReach',
});

interface UseVersionCheckReturn {
  hasUpdate: boolean;
  latestVersion: AppVersion | null;
  currentVersion: string;
  isChecking: boolean;
  showUpdateModal: boolean;
  checkForUpdates: (silent?: boolean) => Promise<void>;
  dismissUpdate: () => void;
  showUpdate: () => void;
}

const useVersionCheck = (): UseVersionCheckReturn => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [latestVersion, setLatestVersion] = useState<AppVersion | null>(null);
  const [currentVersion, setCurrentVersion] = useState('0.0.1');
  const [isChecking, setIsChecking] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // 检查更新的核心逻辑
  // silent: 是否静默检查（不显示加载状态）
  const checkForUpdates = useCallback(async (silent: boolean = false) => {
    if (isChecking) return;

    // 只有非静默模式才显示加载状态
    if (!silent) {
      setIsChecking(true);
    }
    
    try {
      // 获取当前版本信息
      const versionInfo = apiServices.version.getCurrentVersion();
      setCurrentVersion(versionInfo.version);

      // 检查是否需要跳过检查（用户选择稍后更新且时间未到）
      const skipUntil = storage.getString('skipUpdateUntil');
      if (skipUntil) {
        const skipTime = new Date(skipUntil);
        if (new Date() < skipTime) {
          console.log('跳过版本检查，用户选择稍后更新');
          return;
        }
      }

      // 获取最新版本信息
      const response = await apiServices.version.getLatestVersion();

      if (response.success && response.data) {
        const latestVersionData = response.data;
        setLatestVersion(latestVersionData);

        // 在客户端比较版本号
        const compareResult = apiServices.version.compareVersions(
          latestVersionData.version,
          versionInfo.version,
        );

        // 只有当在线版本大于当前版本时才认为有更新
        const hasUpdateAvailable = compareResult > 0;
        setHasUpdate(hasUpdateAvailable);

        if (hasUpdateAvailable) {
          // 检查是否是新版本（避免重复提示）
          const lastNotifiedVersion = storage.getString('lastNotifiedVersion');
          if (lastNotifiedVersion !== latestVersionData.version) {
            setShowUpdateModal(true);
            storage.set('lastNotifiedVersion', latestVersionData.version);
          }
        }
      }
    } catch (error) {
      console.error('检查版本更新失败:', error);
    } finally {
      // 只有非静默模式才清除加载状态
      if (!silent) {
        setIsChecking(false);
      }
    }
  }, [isChecking]);

  // 用户选择稍后更新
  const dismissUpdate = useCallback(() => {
    setShowUpdateModal(false);
    // 设置24小时后再次提醒
    const skipUntil = new Date();
    skipUntil.setHours(skipUntil.getHours() + 24);
    storage.set('skipUpdateUntil', skipUntil.toISOString());
  }, []);

  // 显示更新弹框
  const showUpdate = useCallback(() => {
    setShowUpdateModal(true);
  }, []);

  // 应用启动时检查更新（静默）
  useEffect(() => {
    const checkOnStartup = async () => {
      // 延迟5秒后静默检查，避免影响应用启动速度
      setTimeout(() => {
        checkForUpdates(true);
      }, 5000);
    };

    checkOnStartup();
  }, [checkForUpdates]);

  // 监听应用状态变化，从后台回到前台时检查更新（静默）
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // 检查上次检查时间，避免频繁检查
        const lastCheckTime = storage.getString('lastCheckTime');
        if (lastCheckTime) {
          const lastCheck = new Date(lastCheckTime);
          const now = new Date();
          const timeDiff = now.getTime() - lastCheck.getTime();
          const hoursDiff = timeDiff / (1000 * 3600);

          // 如果距离上次检查超过12小时，则重新检查（降低频率）
          if (hoursDiff >= 12) {
            checkForUpdates(true); // 静默检查
            storage.set('lastCheckTime', new Date().toISOString());
          }
        } else {
          checkForUpdates(true); // 静默检查
          storage.set('lastCheckTime', new Date().toISOString());
        }
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    return () => {
      subscription?.remove();
    };
  }, [checkForUpdates]);

  return {
    hasUpdate,
    latestVersion,
    currentVersion,
    isChecking,
    showUpdateModal,
    checkForUpdates,
    dismissUpdate,
    showUpdate,
  };
};

export default useVersionCheck;
