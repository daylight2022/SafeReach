import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { AppVersion, VersionHistoryResponse } from '@/services/versionService';
import { apiServices } from '@/services/apiServices';

const { width, height } = Dimensions.get('window');

interface UpdateModalProps {
  visible: boolean;
  onClose: () => void;
  latestVersion?: AppVersion;
  currentVersion: string;
}

const UpdateModal: React.FC<UpdateModalProps> = ({
  visible,
  onClose,
  latestVersion,
  currentVersion,
}) => {
  const [versionHistory, setVersionHistory] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAllVersions, setShowAllVersions] = useState(false);

  useEffect(() => {
    if (visible) {
      loadVersionHistory();
    }
  }, [visible]);

  const loadVersionHistory = async () => {
    setLoading(true);
    try {
      const response = await apiServices.version.getVersionHistory(1, 10, false);
      if (response.success && response.data) {
        setVersionHistory(response.data.versions);
      }
    } catch (error) {
      console.error('加载版本历史失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!latestVersion?.downloadUrl) {
      Alert.alert('提示', '暂无下载链接');
      return;
    }

    try {
      const supported = await Linking.canOpenURL(latestVersion.downloadUrl);
      if (supported) {
        await Linking.openURL(latestVersion.downloadUrl);
      } else {
        Alert.alert('错误', '无法打开下载链接');
      }
    } catch (error) {
      console.error('打开下载链接失败:', error);
      Alert.alert('错误', '打开下载链接失败');
    }
  };

  const handleCopyLink = () => {
    if (!latestVersion?.downloadUrl) {
      Alert.alert('提示', '暂无下载链接');
      return;
    }

    Clipboard.setString(latestVersion.downloadUrl);
    Alert.alert('成功', '下载链接已复制到剪贴板');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getUpdateType = (version: string) => {
    const currentParts = currentVersion.split('.').map(Number);
    const versionParts = version.split('.').map(Number);
    
    if (versionParts[0] > currentParts[0]) return '重大更新';
    if (versionParts[1] > currentParts[1]) return '功能更新';
    if (versionParts[2] > currentParts[2]) return '修复更新';
    return '更新';
  };

  const renderVersionItem = (version: AppVersion, isLatest: boolean = false) => (
    <View key={version.id} style={[styles.versionItem, isLatest && styles.latestVersionItem]}>
      <View style={styles.versionHeader}>
        <View style={styles.versionInfo}>
          <Text style={[styles.versionNumber, isLatest && styles.latestVersionNumber]}>
            v{version.version}
            {isLatest && <Text style={styles.latestBadge}> 最新</Text>}
          </Text>
          <Text style={styles.versionDate}>{formatDate(version.releaseDate)}</Text>
        </View>
        {isLatest && (
          <View style={styles.updateTypeBadge}>
            <Text style={styles.updateTypeText}>{getUpdateType(version.version)}</Text>
          </View>
        )}
      </View>
      <Text style={styles.releaseNotes}>{version.releaseNotes}</Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>发现新版本</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {latestVersion && (
            <>
              <View style={styles.currentVersionInfo}>
                <Text style={styles.currentVersionText}>
                  当前版本: v{currentVersion}
                </Text>
                <Text style={styles.newVersionText}>
                  最新版本: v{latestVersion.version}
                </Text>
              </View>

              {renderVersionItem(latestVersion, true)}

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.downloadButton}
                  onPress={handleDownload}
                  disabled={!latestVersion.downloadUrl}
                >
                  <Text style={styles.downloadButtonText}>立即下载</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={handleCopyLink}
                  disabled={!latestVersion.downloadUrl}
                >
                  <Text style={styles.copyButtonText}>复制链接</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <View style={styles.historySection}>
            <TouchableOpacity
              style={styles.historyToggle}
              onPress={() => setShowAllVersions(!showAllVersions)}
            >
              <Text style={styles.historyToggleText}>
                {showAllVersions ? '收起' : '查看'}历史版本
              </Text>
              <Text style={styles.historyToggleIcon}>
                {showAllVersions ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {showAllVersions && (
              <View style={styles.historyList}>
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <Text style={styles.loadingText}>加载中...</Text>
                  </View>
                ) : (
                  versionHistory
                    .filter(v => v.id !== latestVersion?.id)
                    .map(version => renderVersionItem(version))
                )}
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.laterButton} onPress={onClose}>
            <Text style={styles.laterButtonText}>稍后更新</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  currentVersionInfo: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginVertical: 16,
  },
  currentVersionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  newVersionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  versionItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  latestVersionItem: {
    borderColor: '#007AFF',
    backgroundColor: '#f8f9ff',
  },
  versionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  versionInfo: {
    flex: 1,
  },
  versionNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  latestVersionNumber: {
    color: '#007AFF',
  },
  latestBadge: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: 'normal',
  },
  versionDate: {
    fontSize: 12,
    color: '#999',
  },
  updateTypeBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  updateTypeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  releaseNotes: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 20,
  },
  downloadButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  copyButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  copyButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  historySection: {
    marginTop: 20,
  },
  historyToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  historyToggleText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  historyToggleIcon: {
    fontSize: 12,
    color: '#007AFF',
  },
  historyList: {
    marginTop: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  laterButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  laterButtonText: {
    fontSize: 16,
    color: '#666',
  },
});

export default UpdateModal;
