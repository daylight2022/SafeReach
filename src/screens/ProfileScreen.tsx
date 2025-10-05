import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome';
import { NavigationProp } from '@react-navigation/native';
import {
  userService,
  departmentService,
} from '@/services/apiServices';
import { COLORS } from '@/utils/constants';
import { User } from '@/types';
import { toast } from 'burnt';
import { userStorage } from '@/utils/storage';
import { getAppVersionWithPrefix } from '@/utils/version';
import { authEvents } from '@/utils/authEvents';

interface Props {
  navigation: NavigationProp<any>;
}

const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const [user, setUser] = useState<User | null>(null);
  const [departmentName, setDepartmentName] = useState<string>('');
  const [appVersion, setAppVersion] = useState<string>('v1.0.0');

  useEffect(() => {
    loadUserData();
    loadVersionInfo();
  }, []);

  const loadVersionInfo = () => {
    try {
      const version = getAppVersionWithPrefix();
      setAppVersion(version);
    } catch (error) {
      console.error('获取版本信息失败:', error);
    }
  };

  const loadUserData = async () => {
    try {
      // 使用新的用户服务获取当前用户信息
      const dbUser = await userService.getCurrentUser();

      if (dbUser) {
        setUser(dbUser);

        // Load department name if user has departmentId
        if (dbUser.departmentId) {
          try {
            const deptResult = await departmentService.getDepartments();
            if (deptResult.success && deptResult.data) {
              const dept = deptResult.data.find(
                (d: any) => d.id === dbUser.departmentId,
              );
              if (dept) {
                setDepartmentName(dept.name);
              }
            }
          } catch (error) {
            console.error('Load department error:', error);
            setDepartmentName('未知部门');
          }
        }
      } else {
        console.error('获取用户信息失败');
      }
    } catch (error) {
      console.error('Load user data error:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert('退出登录', '确定要退出登录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        style: 'destructive',
        onPress: async () => {
          try {
            // Call backend logout API
            await userService.logout();
          } catch (error) {
            console.error('Logout API error:', error);
            // Continue with logout even if API call fails
          }

          // Clear local storage
          userStorage.clear();

          toast({
            title: '已退出登录',
            preset: 'done',
          });

          // 立即触发认证状态变化事件，通知AppNavigator更新状态
          authEvents.emit();
        },
      },
    ]);
  };

  // 生成所有菜单项，所有用户都可以看到
  const getMenuItems = () => {
    const adminItems = [
      {
        icon: 'bell',
        title: '提醒设置',
        color: COLORS.danger,
        bgColor: '#FEF2F2',
        onPress: () => navigation.navigate('ReminderSettings'),
      },
      {
        icon: 'building-o',
        title: '部门管理',
        color: '#3B82F6',
        bgColor: '#DBEAFE',
        onPress: () => navigation.navigate('Organization'),
      },
    ];

    const baseItems = [
      {
        icon: 'cog',
        title: '通用设置',
        color: COLORS.success,
        bgColor: '#F0FDF4',
        onPress: () => navigation.navigate('GeneralSettings'),
      },
      {
        icon: 'question-circle-o',
        title: '帮助中心',
        color: '#6B7280',
        bgColor: '#F3F4F6',
        onPress: () => navigation.navigate('HelpCenter'),
      },
      {
        icon: 'info-circle',
        title: '关于系统',
        color: '#6B7280',
        bgColor: '#F3F4F6',
        version: appVersion,
        onPress: () => navigation.navigate('About'),
      },
    ];

    return [...adminItems, ...baseItems];
  };

  const menuItems = getMenuItems();

  return (
    <View style={styles.container}>
      {/* Header - 可点击进入个人信息 */}
      <TouchableOpacity
        style={styles.headerContainer}
        onPress={() => navigation.navigate('PersonalInfo')}
        activeOpacity={0.8}
      >
        <LinearGradient colors={COLORS.primaryGradient} style={styles.header}>
          <View style={styles.profileInfo}>
            <View style={styles.avatar}>
              <Icon name="user" size={40} color={COLORS.white} />
            </View>
            <Text style={styles.name}>{user?.realName || '联系员'}</Text>
            <Text style={styles.role}>
              {departmentName || '技术部'} ·{' '}
              {user?.role === 'liaison' ? '联系员' : '管理员'}
            </Text>
            <View style={styles.editButton}>
              <Icon name="edit" size={14} color={COLORS.white} />
              <Text style={styles.editButtonText}>编辑资料</Text>
            </View>
          </View>
          {/* 装饰性元素 */}
          <View style={styles.decoration1} />
          <View style={styles.decoration2} />
          <View style={styles.decoration3} />
        </LinearGradient>
      </TouchableOpacity>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 功能菜单 */}
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
            >
              <View style={styles.menuLeft}>
                <View
                  style={[styles.menuIcon, { backgroundColor: item.bgColor }]}
                >
                  <Icon name={item.icon} size={20} color={item.color} />
                </View>
                <Text style={styles.menuTitle}>{item.title}</Text>
              </View>
              {'version' in item ? (
                <Text style={styles.menuVersion}>{String(item.version)}</Text>
              ) : (
                <Icon name="chevron-right" size={14} color={COLORS.darkGray} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* 退出登录 */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: '#FEF2F2' }]}>
                <Icon name="sign-out" size={20} color={COLORS.danger} />
              </View>
              <Text style={[styles.menuTitle, { color: COLORS.danger }]}>
                退出登录
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 底部安全区域 */}
      {/* <View style={styles.bottomSafeArea} /> */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 60,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    position: 'relative',
  },
  headerContainer: {
    // 无需额外样式，TouchableOpacity 会处理点击
  },
  profileInfo: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 8,
  },
  role: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 16,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  editButtonText: {
    fontSize: 14,
    color: COLORS.white,
    fontWeight: '500',
  },
  decoration1: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  decoration2: {
    position: 'absolute',
    bottom: -30,
    left: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  decoration3: {
    position: 'absolute',
    top: 40,
    left: -30,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: -40,
  },
  menuSection: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTitle: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  menuVersion: {
    fontSize: 14,
    color: COLORS.darkGray,
  },
  logoutButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  bottomSafeArea: {
    height: 20,
    backgroundColor: COLORS.gray,
  },
});

export default ProfileScreen;
