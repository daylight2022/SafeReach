import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome';
import {
  NavigationProp,
  RouteProp,
  useFocusEffect,
} from '@react-navigation/native';
import {
  personService,
  leaveService,
  contactService,
  departmentService,
  reminderService,
} from '@/services/apiServices';
import { COLORS } from '@/utils/constants';
import { Person, Leave, Contact } from '@/types';
import { userStorage } from '@/utils/storage';
import {
  showOperationSuccessToast,
  showOperationErrorToast,
  showWarningToast,
} from '@/utils/errorHandler';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

interface Props {
  navigation: NavigationProp<any>;
  route: RouteProp<any, any>;
}

const PersonDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { personId } = route.params as { personId: string };
  const [person, setPerson] = useState<Person | null>(null);
  const [currentLeave, setCurrentLeave] = useState<Leave | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [departmentName, setDepartmentName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPersonDetail();
  }, [personId]);

  // 页面聚焦时刷新数据（从编辑页面返回时）
  useFocusEffect(
    React.useCallback(() => {
      loadPersonDetail();
    }, [personId]),
  );

  const loadPersonDetail = async () => {
    try {
      // 获取人员信息
      const personResult = await personService.getPerson(personId);
      if (!personResult.success || !personResult.data) {
        throw new Error(personResult.message);
      }
      setPerson(personResult.data);

      // Load department name from person data or API
      const personData = personResult.data;
      if (personData.department && personData.department.name) {
        // Use department info from person data if available
        setDepartmentName(personData.department.name);
      } else if (personData.departmentId) {
        // Fallback to API call if department info not included
        try {
          const deptResult = await departmentService.getDepartments();
          if (deptResult.success && deptResult.data) {
            const dept = deptResult.data.find(
              (d: any) => d.id === personData.departmentId,
            );
            if (dept) {
              setDepartmentName(dept.name);
            }
          }
        } catch (error) {
          console.error('Load department error:', error);
        }
      }

      // 获取当前休假信息
      const leaveResult = await leaveService.getLeaves(personId);
      if (leaveResult.success && leaveResult.data) {
        // 找到当前活跃的休假
        const activeLeave = leaveResult.data.find(
          leave => leave.status === 'active',
        );
        setCurrentLeave(activeLeave || null);
      }

      // 获取联系记录
      const contactResult = await contactService.getContacts(personId);
      if (contactResult.success && contactResult.data) {
        setContacts(contactResult.data.slice(0, 10)); // 限制显示最近10条
      }
    } catch (error) {
      console.error('Load person detail error:', error);
      showOperationErrorToast('load', error, '人员详情');
    } finally {
      setLoading(false);
    }
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleContact = async () => {
    Alert.alert('确认联系', '确认已完成联系？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确认',
        onPress: async () => {
          try {
            const contactDate = new Date().toISOString();

            // 获取当前用户信息
            const currentUser = await userStorage.getCurrentUser();
            if (!currentUser) {
              throw new Error('无法获取当前用户信息，请重新登录');
            }

            // 使用后端API创建联系记录
            const contactResult = await contactService.createContact({
              personId: personId,
              leaveId: currentLeave?.id || undefined, // 确保null转换为undefined
              contactDate: contactDate,
              contactMethod: 'phone',
            });

            if (!contactResult.success) {
              console.error('创建联系记录失败:', contactResult.message);
              throw new Error(`联系记录创建失败: ${contactResult.message}`);
            }

            // 标记该人员的所有未处理提醒记录为已处理
            try {
              const reminderResult =
                await reminderService.handlePersonReminders(personId);
              if (reminderResult.success) {
                const handledCount = reminderResult.data?.handledCount || 0;
                console.log(`✅ 已标记 ${handledCount} 条提醒记录为已处理`);
              } else {
                console.warn('标记提醒记录失败:', reminderResult.message);
                // 不抛出错误，因为联系记录已经创建成功
              }
            } catch (reminderError) {
              console.warn('标记提醒记录时出错:', reminderError);
              // 不抛出错误，因为联系记录已经创建成功
            }

            // 后端已经自动更新了人员的最后联系信息，无需前端重复更新
            showOperationSuccessToast('contact');

            loadPersonDetail();
          } catch (error) {
            console.error('联系确认失败:', error);
            showOperationErrorToast('contact', error);
          }
        },
      },
    ]);
  };

  const handleEdit = () => {
    navigation.navigate('AddPerson', { person });
  };

  const handleDelete = () => {
    Alert.alert('删除人员', `确定要删除 ${person?.name} 吗？此操作不可撤销。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            const result = await personService.deletePerson(personId);
            if (!result.success) {
              throw new Error(result.message);
            }

            showOperationSuccessToast('delete', person?.name);

            navigation.goBack();
          } catch (error) {
            console.error('删除人员失败:', error);
            showOperationErrorToast('delete', error, person?.name);
          }
        },
      },
    ]);
  };

  // 计算距离最后联系的天数（按日历日期计算）
  const getDaysSinceContact = (contactDate: string) => {
    // 使用 startOf('day') 按日历日期计算，而不是绝对24小时
    return dayjs().startOf('day').diff(dayjs(contactDate).startOf('day'), 'days');
  };

  // 格式化最后联系时间为人性化文本
  const getHumanizedContactTime = (contactDate: string) => {
    const days = getDaysSinceContact(contactDate);

    switch (days) {
      case 0:
        return '今天';
      case 1:
        return '昨天';
      case 2:
        return '前天';
      default:
        return `${days}天前`;
    }
  };

  const getStatusInfo = () => {
    // 优先使用从人员列表传过来的状态（基于 reminder 数据）
    const personStatus = person?.status;
    
    if (!currentLeave || personStatus === 'inactive') {
      return {
        color: COLORS.darkGray,
        text: '未在假',
        gradient: [COLORS.darkGray, COLORS.darkGray],
      };
    }

    // 根据从后端返回的状态确定显示信息
    switch (personStatus) {
      case 'urgent':
        return {
          color: COLORS.danger,
          text: '需立即联系',
          gradient: COLORS.dangerGradient,
        };
      case 'suggest':
        return {
          color: COLORS.warning,
          text: '建议联系',
          gradient: COLORS.warningGradient,
        };
      case 'normal':
        return {
          color: COLORS.success,
          text: '正常',
          gradient: COLORS.successGradient,
        };
      default:
        // 如果没有状态信息，返回正常状态
        return {
          color: COLORS.success,
          text: '正常',
          gradient: COLORS.successGradient,
        };
    }
  };

  const statusInfo = getStatusInfo();

  if (loading || !person) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={COLORS.primaryGradient} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <View style={styles.rightButtons}>
            <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
              <Icon name="edit" size={20} color={COLORS.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
            >
              <Icon name="trash" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.profileInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{person.name[0]}</Text>
          </View>
          <Text style={styles.name}>{person.name}</Text>
          <Text style={styles.department}>
            {departmentName || '未设置部门'} ·{' '}
            {person.personType === 'employee'
              ? '员工'
              : person.personType === 'manager'
              ? '小组长'
              : '实习生'}
          </Text>
          <View
            style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}
          >
            <Text style={styles.statusText}>{statusInfo.text}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 在外信息 */}
        {currentLeave && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>在外信息</Text>
            <View style={styles.infoList}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>在外类型</Text>
                <Text style={styles.infoValue}>
                  {currentLeave.leaveType === 'vacation'
                    ? '休假'
                    : currentLeave.leaveType === 'business'
                    ? '出差'
                    : currentLeave.leaveType === 'study'
                    ? '学习'
                    : currentLeave.leaveType === 'hospitalization'
                    ? '住院'
                    : '陪护'}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>在外地点</Text>
                <Text style={styles.infoValue}>
                  {currentLeave.location || '未填写'}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>在外时间</Text>
                <Text style={styles.infoValue}>
                  {dayjs(currentLeave.startDate).format('MM.DD')} -{' '}
                  {dayjs(currentLeave.endDate).format('MM.DD')}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>本次天数</Text>
                <Text style={styles.infoValue}>{currentLeave.days}天</Text>
              </View>
            </View>
          </View>
        )}

        {/* 联系方式 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>联系方式</Text>
          <TouchableOpacity
            style={styles.contactItem}
            onPress={() => person.phone && handleCall(person.phone)}
          >
            <View style={styles.contactLeft}>
              <Icon name="phone" size={20} color={COLORS.success} />
              <View style={styles.contactInfo}>
                <Text style={styles.contactTitle}>本人电话</Text>
                <Text style={styles.contactValue}>
                  {person.phone || '未填写'}
                </Text>
              </View>
            </View>
            <Icon name="chevron-right" size={14} color={COLORS.darkGray} />
          </TouchableOpacity>

          {person.emergencyContact && (
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() =>
                person.emergencyPhone && handleCall(person.emergencyPhone)
              }
            >
              <View style={styles.contactLeft}>
                <Icon name="user-o" size={20} color="#3B82F6" />
                <View style={styles.contactInfo}>
                  <Text style={styles.contactTitle}>第三方联系人</Text>
                  <Text style={styles.contactValue}>
                    {person.emergencyContact} · {person.emergencyPhone}
                  </Text>
                </View>
              </View>
              <Icon name="chevron-right" size={14} color={COLORS.darkGray} />
            </TouchableOpacity>
          )}
        </View>

        {/* 年度假期统计 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>年度假期统计</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statsItem}>
              <Text style={styles.statsLabel}>本年拥有</Text>
              <Text style={styles.statsValue}>{person.annualLeaveTotal}天</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={styles.statsLabel}>已休假期</Text>
              <Text style={styles.statsValue}>{person.annualLeaveUsed}天</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={styles.statsLabel}>剩余假期</Text>
              <Text style={[styles.statsValue, { color: COLORS.success }]}>
                {person.annualLeaveTotal - person.annualLeaveUsed}天
              </Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={styles.statsLabel}>已休次数</Text>
              <Text style={styles.statsValue}>{person.annualLeaveTimes}次</Text>
            </View>
          </View>
        </View>

        {/* 联系记录 */}
        <View style={[styles.card, { marginBottom: 100 }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>联系记录</Text>
            {contacts[0] && (
              <Text style={styles.lastContactText}>
                最后联系：{getHumanizedContactTime(contacts[0].contactDate)}
              </Text>
            )}
          </View>
          <View style={styles.contactList}>
            {contacts.map(contact => (
              <View key={contact.id} style={styles.contactRecord}>
                <View style={styles.recordDot} />
                <Text style={styles.recordDate}>
                  {dayjs(contact.contactDate).format('MM.DD')}
                </Text>
                <Text style={styles.recordText}>
                  {contact.contactUser?.realName || '联系员'} 已联系
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Action Button */}
      {currentLeave && (
        <View style={styles.actionContainer}>
          <TouchableOpacity onPress={handleContact}>
            <LinearGradient
              colors={statusInfo.gradient}
              style={styles.actionButton}
            >
              <Text style={styles.actionButtonText}>完成联系</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 48,
    paddingBottom: 64,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  backButton: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 32,
    fontWeight: 'bold',
  },
  name: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  department: {
    fontSize: 14,
    color: COLORS.white,
    opacity: 0.9,
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    color: COLORS.white,
    fontSize: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: -32,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  lastContactText: {
    fontSize: 12,
    color: COLORS.danger,
  },
  infoList: {
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.darkGray,
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.gray,
    borderRadius: 12,
    marginBottom: 12,
  },
  contactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactInfo: {
    gap: 4,
  },
  contactTitle: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  contactValue: {
    fontSize: 12,
    color: COLORS.darkGray,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statsItem: {
    width: '47%',
    backgroundColor: COLORS.gray,
    padding: 12,
    borderRadius: 12,
  },
  statsLabel: {
    fontSize: 12,
    color: COLORS.darkGray,
    marginBottom: 4,
  },
  statsValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  contactList: {
    gap: 8,
  },
  contactRecord: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordDot: {
    width: 8,
    height: 8,
    backgroundColor: '#D1D5DB',
    borderRadius: 4,
  },
  recordDate: {
    fontSize: 14,
    color: COLORS.darkGray,
  },
  recordText: {
    fontSize: 14,
    color: '#111827',
  },
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PersonDetailScreen;
