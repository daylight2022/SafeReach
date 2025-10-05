import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Dimensions,
  Modal,
  ActivityIndicator,
  Image,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import LinearGradient from 'react-native-linear-gradient';
import { NavigationProp } from '@react-navigation/native';
import { COLORS } from '@/utils/constants';
import { toast } from 'burnt';
import Clipboard from '@react-native-clipboard/clipboard';
import { getAppVersionWithPrefix, getAppBuildNumber } from '@/utils/version';
import useVersionCheck from '@/hooks/useVersionCheck';
import UpdateModal from '@/components/UpdateModal';
import RNFS from 'react-native-fs';

const { width } = Dimensions.get('window');

interface Props {
  navigation: NavigationProp<any>;
}

const AboutScreen: React.FC<Props> = ({ navigation }) => {
  const [showQRCode, setShowQRCode] = useState(false);
  const [appInfo, setAppInfo] = useState({
    name: '安心通',
    version: 'v1.0.0',
    buildNumber: '20250914',
    developer: '周凯迪',
    copyright: '© 2025 All Rights Reserved',
    description:
      '专为企业设计的在外人员联系管理系统，帮助管理者及时了解员工动态，提醒注意事项，确保人员稳定安全。',
  });

  // 使用版本检查 hook
  const {
    hasUpdate,
    latestVersion,
    currentVersion,
    isChecking,
    showUpdateModal,
    checkForUpdates,
    dismissUpdate,
  } = useVersionCheck();

  // 获取应用版本信息
  useEffect(() => {
    const loadVersionInfo = async () => {
      try {
        const version = getAppVersionWithPrefix();
        const buildNumber = await getAppBuildNumber();

        setAppInfo(prev => ({
          ...prev,
          version,
          buildNumber,
        }));
      } catch (error) {
        console.error('获取版本信息失败:', error);
      }
    };

    loadVersionInfo();
  }, []);

  const features = [
    {
      icon: 'users',
      title: '人员管理',
      description: '完整的人员信息管理和状态跟踪',
      gradient: ['#3B82F6', '#60A5FA'],
    },
    {
      icon: 'phone',
      title: '联系记录',
      description: '详细的联系历史和提醒功能',
      gradient: ['#10B981', '#34D399'],
    },
    {
      icon: 'bar-chart',
      title: '数据统计',
      description: '直观的数据分析和报表展示',
      gradient: ['#F59E0B', '#FCD34D'],
    },
    {
      icon: 'shield',
      title: '安全保障',
      description: '数据加密存储和隐私保护',
      gradient: ['#8B5CF6', '#A78BFA'],
    },
  ];

  const developer = {
    name: '周凯迪',
    role: '全栈AI工程师',
    title: '系统架构师',
    skills: [
      'React',
      'Vue',
      'TypeScript',
      'Python',
      'Rust',
      'React Native',
      'AI/ML',
    ],
    experience: '5年+',
    avatar: 'user-circle',
  };

  const handleCheckUpdate = async () => {
    try {
      await checkForUpdates();

      // 如果没有更新，显示提示
      if (!hasUpdate) {
        toast({
          title: '已是最新版本',
          preset: 'done',
          duration: 2,
        });
      }
      // 如果有更新，showUpdateModal 会自动变为 true，UpdateModal 会显示
    } catch (error) {
      console.error('检查更新失败:', error);
      toast({
        title: '检查更新失败',
        preset: 'error',
        duration: 2,
      });
    }
  };

  const handleContact = (type: string) => {
    switch (type) {
      case 'email':
        Linking.openURL('mailto:hyacinth-1@qq.com').catch(() => {
          toast({ title: '无法打开邮箱', preset: 'error', duration: 2 });
        });
        break;
      case 'phone':
        Linking.openURL('tel:18594930897').catch(() => {
          toast({ title: '无法拨打电话', preset: 'error', duration: 2 });
        });
        break;
      case 'wechat':
        // 复制微信号到剪贴板
        Clipboard.setString('zkdmsw_');
        toast({ title: '微信号已复制到剪贴板', preset: 'done', duration: 2 });
        // 显示二维码
        setShowQRCode(true);
        break;
    }
  };

  // 请求存储权限
  const requestStoragePermission = async (): Promise<boolean> => {
    if (Platform.OS === 'ios') {
      return true; // iOS 不需要请求存储权限
    }

    try {
      const androidVersion = typeof Platform.Version === 'string' 
        ? parseInt(Platform.Version, 10) 
        : Platform.Version;
        
      if (androidVersion >= 33) {
        // Android 13+ 不需要存储权限
        return true;
      }

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: '存储权限请求',
          message: '需要存储权限来保存二维码图片',
          buttonNeutral: '稍后询问',
          buttonNegative: '取消',
          buttonPositive: '确定',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('请求存储权限失败:', err);
      return false;
    }
  };

  // 保存二维码图片
  const handleSaveQRCode = async () => {
    try {
      // 请求权限
      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        toast({ title: '需要存储权限才能保存图片', preset: 'error', duration: 2 });
        return;
      }

      // 获取图片源路径（从 assets）
      const imageSource = Image.resolveAssetSource(require('@/assets/qrcode.png'));
      const imagePath = imageSource.uri;
      
      // 确定目标路径
      const timestamp = new Date().getTime();
      const fileName = `wechat_qrcode_${timestamp}.png`;
      
      let destPath: string;
      if (Platform.OS === 'ios') {
        destPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
      } else {
        // Android: 保存到 Pictures 目录
        destPath = `${RNFS.PicturesDirectoryPath}/${fileName}`;
      }

      // 判断是否是 HTTP URL（开发模式）
      if (imagePath.startsWith('http')) {
        // 开发模式：先下载图片到临时目录
        console.log('开发模式：下载图片...', imagePath);
        const downloadResult = await RNFS.downloadFile({
          fromUrl: imagePath,
          toFile: destPath,
        }).promise;

        if (downloadResult.statusCode !== 200) {
          throw new Error('下载图片失败');
        }
      } else {
        // 生产模式：直接复制图片
        console.log('生产模式：复制图片...', imagePath);
        await RNFS.copyFile(imagePath, destPath);
      }

      toast({ 
        title: '二维码已保存到相册', 
        preset: 'done', 
        duration: 2 
      });
    } catch (error) {
      console.error('保存二维码失败:', error);
      toast({ 
        title: '保存失败，请重试', 
        preset: 'error', 
        duration: 2 
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* 优雅的头部 */}
      <LinearGradient
        colors={COLORS.primaryGradient}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={20} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>关于系统</Text>

        {/* 装饰元素 */}
        <View style={styles.decoration1} />
        <View style={styles.decoration2} />
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* 应用信息卡片 */}
        <View style={styles.appCard}>
          <LinearGradient
            colors={COLORS.primaryGradient}
            style={styles.appIcon}
          >
            <Icon name="mobile" size={36} color={COLORS.white} />
          </LinearGradient>

          <Text style={styles.appName}>{appInfo.name}</Text>
          <Text style={styles.appVersion}>{appInfo.version}</Text>
          <Text style={styles.appDescription}>{appInfo.description}</Text>

          <TouchableOpacity
            style={[styles.updateButton, isChecking && styles.updateButtonDisabled]}
            onPress={handleCheckUpdate}
            activeOpacity={0.85}
            disabled={isChecking}
          >
            <LinearGradient
              colors={['#F0F9FF', '#E0F2FE']}
              style={styles.updateGradient}
            >
              {isChecking ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Icon name="refresh" size={16} color={COLORS.primary} />
              )}
              <Text style={styles.updateText}>
                {isChecking ? '检查中...' : '检查更新'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* 开发者卡片 - 精美设计 */}
        <View style={styles.developerSection}>
          <Text style={styles.sectionTitle}>开发者</Text>

          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.developerCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* 装饰性背景 */}
            <View style={styles.devDecoration1} />
            <View style={styles.devDecoration2} />
            <View style={styles.devDecoration3} />

            <View style={styles.developerContent}>
              <View style={styles.devHeader}>
                <View style={styles.devAvatar}>
                  <Icon
                    name={developer.avatar}
                    size={36}
                    color={COLORS.white}
                  />
                </View>
                <View style={styles.vipBadge}>
                  <Text style={styles.vipText}>PRO</Text>
                </View>
              </View>

              <Text style={styles.devName}>{developer.name}</Text>
              <Text style={styles.devTitle}>{developer.title}</Text>
              <Text style={styles.devRole}>{developer.role}</Text>

              <View style={styles.skillsSection}>
                <Text style={styles.skillsTitle}>技能专长</Text>
                <View style={styles.skillsGrid}>
                  {developer.skills.map((skill, index) => (
                    <View key={index} style={styles.skillTag}>
                      <Text style={styles.skillText}>{skill}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.experienceBadge}>
                <Icon name="star" size={14} color="#FFD700" />
                <Text style={styles.experienceText}>
                  经验：{developer.experience}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* 核心功能网格 */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>核心功能</Text>

          <View style={styles.featuresGrid}>
            {features.map((feature, index) => (
              <TouchableOpacity
                key={index}
                style={styles.featureCard}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={feature.gradient}
                  style={styles.featureIcon}
                >
                  <Icon name={feature.icon} size={24} color={COLORS.white} />
                </LinearGradient>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDesc}>{feature.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 联系方式 */}
        <View style={styles.contactSection}>
          <Text style={styles.sectionTitle}>联系我</Text>

          <View style={styles.contactGrid}>
            <TouchableOpacity
              style={styles.contactCard}
              onPress={() => handleContact('email')}
              activeOpacity={0.85}
            >
              <View
                style={[styles.contactIcon, { backgroundColor: '#FEE2E2' }]}
              >
                <Icon name="envelope" size={20} color="#EF4444" />
              </View>
              <Text style={styles.contactLabel}>邮箱</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contactCard}
              onPress={() => handleContact('phone')}
              activeOpacity={0.85}
            >
              <View
                style={[styles.contactIcon, { backgroundColor: '#DBEAFE' }]}
              >
                <Icon name="phone" size={20} color="#3B82F6" />
              </View>
              <Text style={styles.contactLabel}>电话</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contactCard}
              onPress={() => handleContact('wechat')}
              activeOpacity={0.85}
            >
              <View
                style={[styles.contactIcon, { backgroundColor: '#F3E8FF' }]}
              >
                <Icon name="wechat" size={20} color="#10B981" />
              </View>
              <Text style={styles.contactLabel}>微信</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 法律信息 */}
        {/* <View style={styles.legalSection}>
          {['用户协议', '隐私政策', '开源协议'].map((item, index) => (
            <TouchableOpacity 
              key={index}
              style={styles.legalItem}
              onPress={index === 2 ? handleOpenSource : undefined}
              activeOpacity={0.85}
            >
              <Text style={styles.legalText}>{item}</Text>
              <Icon name="chevron-right" size={12} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View> */}

        {/* 版权信息 */}
        <View style={styles.copyright}>
          <Text style={styles.copyrightText}>{appInfo.copyright}</Text>
          <Text style={styles.copyrightSubtext}>感谢您使用我的产品</Text>
        </View>
      </ScrollView>

      {/* 微信二维码模态框 */}
      <Modal
        visible={showQRCode}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQRCode(false)}
      >
        <View style={styles.qrModal}>
          <View style={styles.qrModalContent}>
            <TouchableOpacity
              style={styles.qrCloseButton}
              onPress={() => setShowQRCode(false)}
            >
              <Icon name="times" size={20} color="#6B7280" />
            </TouchableOpacity>

            <Text style={styles.qrTitle}>添加微信</Text>
            <Text style={styles.qrSubtitle}>微信号：zkdmsw_</Text>

            {/* 二维码图片 */}
            <TouchableOpacity
              onLongPress={handleSaveQRCode}
              activeOpacity={0.8}
              delayLongPress={500}
            >
              <Image
                source={require('@/assets/qrcode.png')}
                style={styles.qrCodeImage}
                resizeMode="contain"
              />
              <Text style={styles.qrLongPressHint}>长按图片保存</Text>
            </TouchableOpacity>

            <View style={styles.qrButtonGroup}>
              <TouchableOpacity
                style={styles.qrActionButton}
                onPress={() => {
                  Clipboard.setString('zkdmsw_');
                  toast({ title: '微信号已复制', preset: 'done', duration: 2 });
                }}
              >
                <Icon name="copy" size={16} color={COLORS.primary} />
                <Text style={styles.qrActionText}>复制微信号</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.qrActionButton}
                onPress={handleSaveQRCode}
              >
                <Icon name="download" size={16} color={COLORS.primary} />
                <Text style={styles.qrActionText}>保存图片</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 版本更新弹框 */}
      <UpdateModal
        visible={showUpdateModal}
        onClose={dismissUpdate}
        latestVersion={latestVersion || undefined}
        currentVersion={currentVersion}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFB',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 80,
    position: 'relative',
    overflow: 'hidden',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'center',
    marginTop: 8,
  },
  decoration1: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  decoration2: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  content: {
    flex: 1,
    marginTop: -40,
  },
  appCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 28,
    marginHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 6,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  appVersion: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  appDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  updateButton: {
    width: '100%',
  },
  updateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
  },
  updateText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  updateButtonDisabled: {
    opacity: 0.6,
  },
  developerSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  developerCard: {
    borderRadius: 24,
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  developerContent: {
    position: 'relative',
    zIndex: 2,
  },
  devHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  devAvatar: {
    width: 72,
    height: 72,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  vipBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    transform: [{ rotate: '12deg' }],
  },
  vipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333',
  },
  devName: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 6,
  },
  devTitle: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.95)',
    marginBottom: 4,
  },
  devRole: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 20,
  },
  skillsSection: {
    marginBottom: 20,
  },
  skillsTitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 10,
    fontWeight: '600',
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillTag: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  skillText: {
    fontSize: 13,
    color: COLORS.white,
    fontWeight: '600',
  },
  experienceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  experienceText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '600',
  },
  devDecoration1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
    zIndex: 1,
  },
  devDecoration2: {
    position: 'absolute',
    bottom: -50,
    left: -50,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
    zIndex: 1,
  },
  devDecoration3: {
    position: 'absolute',
    top: '40%',
    right: -60,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    zIndex: 1,
  },
  featuresSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  featureCard: {
    flex: 1,
    minWidth: (width - 56) / 2,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  featureDesc: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  contactSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  contactGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  contactCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  legalSection: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  legalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  legalText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  copyright: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingBottom: 50,
  },
  copyrightText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  copyrightSubtext: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  // 微信二维码模态框样式
  qrModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrModalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    margin: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  qrCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 1,
  },
  qrTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    marginTop: 16,
  },
  qrSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  qrCodeImage: {
    width: 240,
    height: 240,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    padding: 8,
  },
  qrLongPressHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    marginBottom: 16,
    textAlign: 'center',
  },
  qrButtonGroup: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  qrActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  qrActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
  },
});

export default AboutScreen;
