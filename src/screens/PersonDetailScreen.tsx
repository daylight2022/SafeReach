import React, { useState, useEffect } from 'react';
import {
  Animated,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

const PersonDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { personId } = route.params as { personId: string };
  const insets = useSafeAreaInsets();
  const TOP_BAR_HEIGHT = 56;
  const HEADER_HEIGHT = 280;
  const scrollY = React.useRef(new Animated.Value(0)).current;

  const headerCollapseDistance =
    HEADER_HEIGHT - (insets.top + TOP_BAR_HEIGHT);

  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, headerCollapseDistance],
    outputRange: [0, -headerCollapseDistance],
    extrapolate: 'clamp',
  });

  const collapsedTitleOpacity = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [0.0, 1],
    extrapolate: 'clamp',
  });

  const topBarBgOpacity = scrollY.interpolate({
    inputRange: [0, 80, 140],
    outputRange: [0.72, 0.9, 1],
    extrapolate: 'clamp',
  });

  const topBarScrimOpacity = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [0.28, 0.5],
    extrapolate: 'clamp',
  });
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
      <AnimatedLinearGradient
        colors={COLORS.primaryGradient}
        style={[
          styles.headerBackground,
          {
            height: HEADER_HEIGHT,
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      />

      <AnimatedLinearGradient
        pointerEvents="none"
        colors={['rgba(249,250,251,0)', COLORS.background]}
        style={[
          styles.headerFade,
          {
            top: HEADER_HEIGHT - 140,
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: HEADER_HEIGHT,
            paddingBottom: 24,
          },
        ]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      >
        <View style={styles.content}>
          <View
            style={[
              styles.profileCard,
              {
                marginTop:
                  -(HEADER_HEIGHT - (insets.top + TOP_BAR_HEIGHT + 16)),
              },
            ]}
          >
            <LinearGradient
              colors={['rgba(99,102,241,0.16)', 'rgba(139,92,246,0.08)']}
              style={styles.profileHeader}
            >
              <View style={styles.profileTopRow}>
                <View style={styles.avatarCompact}>
                  <Text style={styles.avatarCompactText}>{person.name[0]}</Text>
                </View>
                <View style={styles.profileMain}>
                  <Text style={styles.profileName}>{person.name}</Text>
                  <Text style={styles.profileSub} numberOfLines={1}>
                    {departmentName || '未设置部门'} ·{' '}
                    {person.personType === 'employee'
                      ? '员工'
                      : person.personType === 'manager'
                      ? '小组长'
                      : '实习生'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: statusInfo.color },
                  ]}
                >
                  <Text style={styles.statusPillText}>{statusInfo.text}</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={styles.profileBody}>
              {!currentLeave && (
                <View style={styles.chipRow}>
                  <View style={styles.infoChip}>
                    <Icon name="clock-o" size={16} color={COLORS.primary} />
                    <View>
                      <Text style={styles.infoChipSubText}>最后联系</Text>
                      <Text style={styles.infoChipText} numberOfLines={1}>
                        {contacts[0]
                          ? getHumanizedContactTime(contacts[0].contactDate)
                          : '暂无'}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {currentLeave && (
                <View style={styles.profileSection}>
                  <View style={styles.profileSectionHeader}>
                    <View style={styles.profileSectionTitleLeft}>
                      <View style={styles.profileSectionAccent} />
                      <Text style={styles.profileSectionTitle}>在外信息</Text>
                    </View>
                    <Text style={styles.profileSectionMeta}>
                      {dayjs(currentLeave.startDate).format('MM.DD')} -{' '}
                      {dayjs(currentLeave.endDate).format('MM.DD')}
                    </Text>
                  </View>

                  <View style={styles.profileSectionCard}>
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
                        <Text
                          style={styles.infoValue}
                          numberOfLines={2}
                          ellipsizeMode="tail"
                        >
                          {currentLeave.location || '未填写'}
                        </Text>
                      </View>
                      <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>本次天数</Text>
                        <Text style={styles.infoValue}>{currentLeave.days}天</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.leaveActionsRow}>
                    <View style={styles.leaveMetaChip}>
                      <Icon name="clock-o" size={16} color={COLORS.primary} />
                      <View>
                        <Text style={styles.leaveMetaLabel}>最后联系</Text>
                        <Text style={styles.leaveMetaValue} numberOfLines={1}>
                          {contacts[0]
                            ? getHumanizedContactTime(contacts[0].contactDate)
                            : '暂无'}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.leaveCtaTouchable}
                      onPress={handleContact}
                      activeOpacity={0.9}
                    >
                      <LinearGradient
                        colors={statusInfo.gradient}
                        style={styles.leaveCtaButton}
                      >
                        <Icon name="check" size={16} color={COLORS.white} />
                        <Text style={styles.leaveCtaText}>完成联系</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>

        <View style={styles.card}>
          <View style={styles.cardSectionHeader}>
            <View style={styles.cardTitleRow}>
              <View style={styles.cardTitleLeft}>
                <View style={styles.cardAccent} />
                <Text style={styles.cardTitle}>联系方式</Text>
              </View>
            </View>
          </View>

          <View style={styles.cardSectionBody}>
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
        </View>

        <View style={styles.card}>
          <View style={styles.cardSectionHeader}>
            <View style={styles.cardTitleRow}>
              <View style={styles.cardTitleLeft}>
                <View style={styles.cardAccent} />
                <Text style={styles.cardTitle}>年度假期统计</Text>
              </View>
            </View>
          </View>

          <View style={styles.cardSectionBody}>
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
        </View>

        <View style={styles.card}>
          <View style={styles.cardSectionHeader}>
            <View style={styles.cardTitleRow}>
              <View style={styles.cardTitleLeft}>
                <View style={styles.cardAccent} />
                <Text style={styles.cardTitle}>联系记录</Text>
              </View>
              {contacts[0] && (
                <Text style={styles.lastContactText}>
                  最后联系：{getHumanizedContactTime(contacts[0].contactDate)}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.cardSectionBody}>
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
        </View>

        </View>
      </Animated.ScrollView>

      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top,
            height: insets.top + TOP_BAR_HEIGHT,
          },
        ]}
      >
        <AnimatedLinearGradient
          colors={COLORS.primaryGradient}
          style={[StyleSheet.absoluteFillObject, { opacity: topBarBgOpacity }]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: '#111827', opacity: topBarScrimOpacity },
          ]}
        />
        <View style={[styles.topBarRow, { height: TOP_BAR_HEIGHT }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={20} color={COLORS.white} />
          </TouchableOpacity>

          <Animated.Text
            style={[styles.topBarTitle, { opacity: collapsedTitleOpacity }]}
            numberOfLines={1}
          >
            {person.name}
          </Animated.Text>

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
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  headerFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 140,
  },
  scrollContent: {
    paddingHorizontal: 16,
    backgroundColor: COLORS.background,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 10,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  topBarTitle: {
    flex: 1,
    marginHorizontal: 12,
    textAlign: 'center',
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(17,24,39,0.22)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(17,24,39,0.22)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(17,24,39,0.22)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingBottom: 16,
  },
  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 0,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  profileHeader: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229,231,235,0.9)',
  },
  profileBody: {
    padding: 16,
    backgroundColor: COLORS.white,
  },
  primaryCtaWrap: {
    marginTop: 14,
  },
  primaryCtaButton: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  primaryCtaText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  profileSection: {
    marginTop: 16,
  },
  profileSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  profileSectionTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileSectionAccent: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  profileSectionTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
  },
  profileSectionMeta: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  profileSectionCard: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  leaveActionsRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  leaveMetaChip: {
    flex: 0.65,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 52,
  },
  leaveMetaLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  leaveMetaValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  leaveCtaTouchable: {
    flex: 1.35,
    minHeight: 52,
  },
  leaveCtaButton: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
  },
  leaveCtaText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoChipText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  infoChipSubText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCompact: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCompactText: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: '800',
  },
  profileMain: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  profileSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusPillText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 0,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 1,
  },
  cardSectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(99,102,241,0.06)',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardAccent: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  cardSectionBody: {
    padding: 16,
    backgroundColor: COLORS.white,
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
    color: COLORS.text,
    marginBottom: 0,
  },
  lastContactText: {
    fontSize: 12,
    color: COLORS.danger,
    fontWeight: '600',
  },
  infoList: {
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  infoLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 0,
    minWidth: 70,
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    flexShrink: 1,
  },
  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    color: COLORS.text,
    fontWeight: '500',
  },
  contactValue: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statsItem: {
    width: '47%',
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statsLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  statsValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  contactList: {
    gap: 10,
  },
  contactRecord: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 2,
  },
  recordDot: {
    width: 8,
    height: 8,
    backgroundColor: '#C7D2FE',
    borderRadius: 4,
  },
  recordDate: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  recordText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  actionContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 1,
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
