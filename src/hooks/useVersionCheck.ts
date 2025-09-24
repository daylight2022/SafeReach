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
  checkForUpdates: () => Promise<void>;
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
  const checkForUpdates = useCallback(async () => {
    if (isChecking) return;

    setIsChecking(true);
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

      // 检查版本更新
      const response = await apiServices.version.checkForUpdates();
      
      if (response.success && response.data) {
        const checkResult = response.data;
        setHasUpdate(checkResult.hasUpdate);
        
        if (checkResult.hasUpdate && checkResult.latestVersion) {
          setLatestVersion(checkResult.latestVersion);
          
          // 检查是否是新版本（避免重复提示）
          const lastNotifiedVersion = storage.getString('lastNotifiedVersion');
          if (lastNotifiedVersion !== checkResult.latestVersion.version) {
            setShowUpdateModal(true);
            storage.set('lastNotifiedVersion', checkResult.latestVersion.version);
          }
        }
      }
    } catch (error) {
      console.error('检查版本更新失败:', error);
    } finally {
      setIsChecking(false);
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

  // 应用启动时检查更新
  useEffect(() => {
    const checkOnStartup = async () => {
      // 延迟3秒后检查，避免影响应用启动速度
      setTimeout(() => {
        checkForUpdates();
      }, 3000);
    };

    checkOnStartup();
  }, [checkForUpdates]);

  // 监听应用状态变化，从后台回到前台时检查更新
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
          
          // 如果距离上次检查超过4小时，则重新检查
          if (hoursDiff >= 4) {
            checkForUpdates();
          }
        } else {
          checkForUpdates();
        }
        
        // 更新最后检查时间
        storage.set('lastCheckTime', new Date().toISOString());
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
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
