import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useFocusEffect } from '@react-navigation/native';
import { userStorage } from '@/utils/storage';
import { COLORS } from '@/utils/constants';
import StatusCard from '@/components/StatusCard';
import { apiServices } from '@/services/apiServices';

const DashboardScreen = ({ navigation }: any) => {
  const [urgentPersons, setUrgentPersons] = useState<any[]>([]);
  const [todayTasks, setTodayTasks] = useState<any[]>([]);

  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    loadCurrentUser();
    loadUserInfo();
  }, []);

  // 页面聚焦时刷新数据
  useFocusEffect(
    React.useCallback(() => {
      loadCurrentUser();
    }, []),
  );

  const loadCurrentUser = async () => {
    try {
      // 所有用户都可以看到仪表板，加载仪表板数据
      loadDashboardData();
    } catch (error) {
      console.error('获取当前用户信息失败:', error);
    }
  };

  const loadUserInfo = () => {
    try {
      const userData = userStorage.get();
      if (userData) {
        setUserName(userData.username || '联系员');
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      // 获取紧急关注人员
      const urgentResult = await apiServices.reminder.getReminders({
        priority: 'high',
        isHandled: false,
      });

      if (urgentResult.success) {
        setUrgentPersons(urgentResult.data?.reminders || []);
      } else {
        console.error('获取紧急关注人员失败:', urgentResult.message);
        setUrgentPersons([]);
      }

      // 获取今日待办
      const today = new Date().toISOString().split('T')[0];
      console.log('今日日期:', today); // 调试日志
      const tasksResult = await apiServices.reminder.getReminders({
        reminderDate: today,
        isHandled: false,
      });

      if (tasksResult.success) {
        console.log('今日待办查询结果:', tasksResult.data); // 调试日志
        setTodayTasks(tasksResult.data?.reminders || []);
      } else {
        console.error('获取今日待办失败:', tasksResult.message);
        setTodayTasks([]);
      }
    } catch (error) {
      console.error('加载仪表板数据失败:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleContact = async (personId: any) => {
    navigation.navigate('PersonDetail', { personId });
  };

  // 所有用户都可以看到仪表板内容

  return (
    <View style={styles.container}>
      <LinearGradient colors={COLORS.primaryGradient} style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.welcomeText}>欢迎回来</Text>
            <Text style={styles.userName}>{userName || '联系员'}</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Icon name="bell" size={20} color={COLORS.white} />
            {urgentPersons.length > 0 && (
              <View style={styles.notificationDot} />
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* 紧急关注 */}
        <StatusCard
          title="紧急关注"
          count={urgentPersons.length}
          status="urgent"
          items={urgentPersons}
          onItemPress={handleContact}
        />

        {/* 今日待办 */}
        <StatusCard
          title="今日待办"
          count={todayTasks.length}
          status="warning"
          items={todayTasks}
          onItemPress={handleContact}
        />

        {/* 快捷操作 */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('AddPerson')}
          >
            <LinearGradient
              colors={COLORS.primaryGradient}
              style={styles.actionIcon}
            >
              <Icon name="user-plus" size={20} color={COLORS.white} />
            </LinearGradient>
            <Text style={styles.actionText}>添加人员</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Statistics')}
          >
            <LinearGradient
              colors={COLORS.successGradient}
              style={styles.actionIcon}
            >
              <Icon name="line-chart" size={20} color={COLORS.white} />
            </LinearGradient>
            <Text style={styles.actionText}>数据统计</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray,
  },
  header: {
    paddingTop: 48,
    paddingBottom: 90,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  welcomeText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  userName: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  notificationButton: {
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 8,
    height: 8,
    backgroundColor: COLORS.danger,
    borderRadius: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: -64,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 14,
    color: '#374151',
  },
});

export default DashboardScreen;
