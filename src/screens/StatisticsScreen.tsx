import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  RefreshControl,
  Modal,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome';
import Svg, { Rect, Circle } from 'react-native-svg';
import { NavigationProp } from '@react-navigation/native';
import { statisticsService } from '../services/apiServices';
import { COLORS } from '../utils/constants';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import relativeTime from 'dayjs/plugin/relativeTime';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';

dayjs.extend(relativeTime);
dayjs.extend(quarterOfYear);
dayjs.locale('zh-cn');

const { width: screenWidth } = Dimensions.get('window');

interface Props {
  navigation: NavigationProp<any>;
}

interface TrendData {
  current: number;
  previous: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

interface Trends {
  avgContactInterval: TrendData;
  urgentCount: TrendData;
  unhandledReminders: TrendData;
}

interface ReminderSettings {
  urgentThreshold: number;
  suggestThreshold: number;
}

interface Statistics {
  totalContacts: number;
  totalPersons: number;
  activePersons: number;
  weeklyData: number[];
  statusDistribution: {
    normal: { count: number; percentage: number };
    suggest: { count: number; percentage: number };
    urgent: { count: number; percentage: number };
  };
  departmentRanking: Array<{
    departmentId: string;
    name: string;
    avgContactInterval: number;    // 平均联系间隔
    urgentCount: number;
    totalReminders: number;
    unhandledReminders: number;
    healthScore?: number;
  }>;
  responseMetrics?: {
    totalReminders: number;        // 本月提醒总数
    unhandledReminders: number;    // 未处理提醒数
    avgContactInterval: number;    // 平均联系间隔天数
  };
  healthScore?: number;
  healthScoreDetails?: {
    totalPersonsWithReminders: number;
    avgContactInterval: number;
  };
  trends?: Trends;
}

const StatisticsScreen: React.FC<Props> = ({ navigation }) => {
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year'>(
    'month',
  );
  const [statistics, setStatistics] = useState<Statistics>({
    totalContacts: 0,
    totalPersons: 0,
    activePersons: 0,
    weeklyData: [0, 0, 0, 0, 0, 0, 0],
    statusDistribution: {
      normal: { count: 0, percentage: 0 },
      suggest: { count: 0, percentage: 0 },
      urgent: { count: 0, percentage: 0 },
    },
    departmentRanking: [],
    healthScore: 0,
    trends: {
      avgContactInterval: { current: 0, previous: 0, change: 0, trend: 'stable' },
      urgentCount: { current: 0, previous: 0, change: 0, trend: 'stable' },
      unhandledReminders: { current: 0, previous: 0, change: 0, trend: 'stable' },
    },
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>({
    urgentThreshold: 10,
    suggestThreshold: 7,
  });

  useEffect(() => {
    loadReminderSettings();
    loadStatistics();
  }, [timeRange]);

  const loadReminderSettings = async () => {
    try {
      const result = await statisticsService.getReminderSettings();
      if (result.success && result.data) {
        setReminderSettings({
          urgentThreshold: result.data.urgentThreshold,
          suggestThreshold: result.data.suggestThreshold,
        });
      }
    } catch (error) {
      console.error('加载提醒设置失败:', error);
    }
  };

  // 渲染健康度规则说明Modal
  const renderRuleModal = () => (
    <Modal
      visible={showRuleModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowRuleModal(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowRuleModal(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>健康度评分规则</Text>
                <TouchableOpacity
                  onPress={() => setShowRuleModal(false)}
                  style={styles.modalCloseButton}
                >
                  <Icon name="times" size={20} color={COLORS.darkGray} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalBody}>
                <Text style={styles.ruleDescription}>
                  基于联系间隔的扣分制（满分100分，含1天宽容期）
                </Text>
                <Text style={{fontSize: 13, color: '#6B7280', marginBottom: 12}}>
                  💡 综合统计所有联系间隔的平均值
                </Text>
                <View style={styles.ruleList}>
                  <View style={styles.ruleItem}>
                    <View style={[styles.ruleDot, { backgroundColor: COLORS.success }]} />
                <Text style={styles.ruleText}>
                  联系间隔≤8天（7天+1天宽容）：不扣分
                </Text>
              </View>
              <View style={styles.ruleItem}>
                <View style={[styles.ruleDot, { backgroundColor: COLORS.warning }]} />
                <Text style={styles.ruleText}>
                  联系间隔9-11天：每多一天扣1分
                </Text>
              </View>
              <View style={styles.ruleItem}>
                <View style={[styles.ruleDot, { backgroundColor: COLORS.danger }]} />
                <Text style={styles.ruleText}>
                  联系间隔>11天（10天+1天宽容）：每多一天扣3分
                </Text>
              </View>
                </View>
                <Text style={styles.ruleNote}>
                  * 联系间隔计算：第一次（休假开始到首次联系）+ 中间（每两次联系之间）+ 最后一次（最后联系到当前，仅当休假未结束）
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const loadStatistics = async () => {
    setLoading(true);
    try {
      // 计算时间范围
      const startDate = getStartDate();
      const endDate = getEndDate();

      // 获取基础统计数据
      const statsResult = await statisticsService.getStatistics(
        startDate,
        endDate,
      );

      if (statsResult.success && statsResult.data) {
        const data = statsResult.data;
        
        // 调试日志：查看后端返回的原始数据
        console.log('📊 统计数据 - 原始响应:', JSON.stringify(data, null, 2));
        console.log('📊 健康度评分:', data.healthScore);
        console.log('📊 趋势数据:', data.trends);
        console.log('📊 部门排名:', data.departmentRanking);
        console.log('📊 状态分布:', data.statusDistribution);

        setStatistics({
          totalContacts: data.totalContacts || 0,
          totalPersons: data.totalPersons || 0,
          activePersons: data.activePersons || 0,
          weeklyData: data.weeklyData || [0, 0, 0, 0, 0, 0, 0],
          statusDistribution: data.statusDistribution || {
            normal: { count: 0, percentage: 0 },
            suggest: { count: 0, percentage: 0 },
            urgent: { count: 0, percentage: 0 },
          },
          departmentRanking: data.departmentRanking || [],
          responseMetrics: data.responseMetrics,
          healthScore: data.healthScore || 0,
          trends: data.trends || {
            avgContactInterval: { current: 0, previous: 0, change: 0, trend: 'stable' },
            urgentCount: { current: 0, previous: 0, change: 0, trend: 'stable' },
            unhandledReminders: { current: 0, previous: 0, change: 0, trend: 'stable' },
          },
        });
      } else {
        console.error('获取统计数据失败:', statsResult.message);
        // 设置默认数据
        setStatistics({
          totalContacts: 0,
          totalPersons: 0,
          activePersons: 0,
          weeklyData: [0, 0, 0, 0, 0, 0, 0],
          statusDistribution: {
            normal: { count: 0, percentage: 0 },
            suggest: { count: 0, percentage: 0 },
            urgent: { count: 0, percentage: 0 },
          },
          departmentRanking: [],
          healthScore: 0,
          trends: {
            avgContactInterval: { current: 0, previous: 0, change: 0, trend: 'stable' },
            urgentCount: { current: 0, previous: 0, change: 0, trend: 'stable' },
            unhandledReminders: { current: 0, previous: 0, change: 0, trend: 'stable' },
          },
        });
      }
    } catch (error) {
      console.error('Load statistics error:', error);
      // 设置默认数据
      setStatistics({
        totalContacts: 0,
        totalPersons: 0,
        activePersons: 0,
        weeklyData: [0, 0, 0, 0, 0, 0, 0],
        statusDistribution: {
          normal: { count: 0, percentage: 0 },
          suggest: { count: 0, percentage: 0 },
          urgent: { count: 0, percentage: 0 },
        },
        departmentRanking: [],
        healthScore: 0,
        trends: {
          avgContactInterval: { current: 0, previous: 0, change: 0, trend: 'stable' },
          urgentCount: { current: 0, previous: 0, change: 0, trend: 'stable' },
          unhandledReminders: { current: 0, previous: 0, change: 0, trend: 'stable' },
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStatistics();
    setRefreshing(false);
  };

  const getStartDate = () => {
    switch (timeRange) {
      case 'month':
        return dayjs().startOf('month').format('YYYY-MM-DD');
      case 'quarter':
        return dayjs().startOf('quarter').format('YYYY-MM-DD');
      case 'year':
        return dayjs().startOf('year').format('YYYY-MM-DD');
      default:
        return dayjs().startOf('month').format('YYYY-MM-DD');
    }
  };

  const getEndDate = () => {
    switch (timeRange) {
      case 'month':
        return dayjs().endOf('month').format('YYYY-MM-DD');
      case 'quarter':
        return dayjs().endOf('quarter').format('YYYY-MM-DD');
      case 'year':
        return dayjs().endOf('year').format('YYYY-MM-DD');
      default:
        return dayjs().endOf('month').format('YYYY-MM-DD');
    }
  };

  const renderChart = () => {
    const chartWidth = screenWidth - 64;
    const chartHeight = 120;
    const maxValue = Math.max(...statistics.weeklyData);

    return (
      <Svg width={chartWidth} height={chartHeight}>
        {statistics.weeklyData.map((value, index) => {
          const barWidth = chartWidth / 7 - 8;
          const barHeight = (value / maxValue) * (chartHeight - 20);
          const x = index * (chartWidth / 7) + 4;
          const y = chartHeight - barHeight - 20;

          return (
            <Rect
              key={index}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={COLORS.primary}
              opacity={0.5 + index * 0.1}
              rx={4}
              ry={4}
            />
          );
        })}
      </Svg>
    );
  };

  // 渲染健康度评分环形图
  const renderHealthScore = () => {
    const score = statistics.healthScore || 0;
    const radius = 50;
    const strokeWidth = 10;
    const normalizedRadius = radius - strokeWidth / 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    // 根据分数确定颜色和评级
    let color = COLORS.success;
    let grade = '优秀';
    if (score < 70) {
      color = COLORS.danger;
      grade = '需改进';
    } else if (score < 80) {
      color = COLORS.warning;
      grade = '及格';
    } else if (score < 90) {
      color = COLORS.primary;
      grade = '良好';
    }

    return (
      <View style={styles.healthScoreContainer}>
        <Svg height={radius * 2} width={radius * 2}>
          {/* 背景圆环 */}
          <Circle
            stroke="#E5E7EB"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          {/* 进度圆环 */}
          <Circle
            stroke={color}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            rotation="-90"
            origin={`${radius}, ${radius}`}
          />
        </Svg>
        <View style={styles.healthScoreTextContainer}>
          <Text style={[styles.healthScoreValue, { color }]}>{score}</Text>
          <Text style={styles.healthScoreLabel}>{grade}</Text>
        </View>
      </View>
    );
  };

  // 渲染趋势指示器
  const renderTrendIndicator = (trend: TrendData, isPositiveGood: boolean = true, isDecimal: boolean = false) => {
    if (trend.change === 0) {
      return <Text style={styles.trendText}>-</Text>;
    }

    const isGood = isPositiveGood
      ? trend.trend === 'up'
      : trend.trend === 'down';
    const color = isGood ? COLORS.success : COLORS.danger;
    const icon = trend.trend === 'up' ? 'arrow-up' : 'arrow-down';

    // 根据是否是小数类型决定显示格式
    const changeValue = isDecimal 
      ? trend.change.toFixed(1)
      : Math.abs(trend.change).toString();

    return (
      <View style={styles.trendContainer}>
        <Icon name={icon} size={12} color={color} />
        <Text style={[styles.trendText, { color }]}>
          {changeValue}{isDecimal ? '天' : isPositiveGood ? '%' : '人'}
        </Text>
      </View>
    );
  };

  // 判断是否需要显示预警
  const getAlerts = () => {
    const alerts = [];
    
    const urgentCount = statistics.statusDistribution?.urgent?.count || 0;
    if (urgentCount > 1) {
      alerts.push({
        type: 'danger',
        icon: 'exclamation-triangle',
        message: `当前有 ${urgentCount} 人需紧急联系！`,
      });
    }

    if ((statistics.responseMetrics?.unhandledReminders || 0) > 3) {
      alerts.push({
        type: 'warning',
        icon: 'bell',
        message: `有 ${statistics.responseMetrics?.unhandledReminders} 个提醒未处理！`,
      });
    }

    if ((statistics.responseMetrics?.avgContactInterval || 0) > 11) {
      alerts.push({
        type: 'info',
        icon: 'lightbulb-o',
        message: '平均联系间隔偏长，建议加强日常联系',
      });
    }

    return alerts;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={COLORS.primaryGradient} style={styles.header}>
        <Text style={styles.title}>数据统计</Text>
        <View style={styles.tabContainer}>
          {(['month', 'quarter', 'year'] as const).map(range => (
            <TouchableOpacity
              key={range}
              style={[styles.tab, timeRange === range && styles.tabActive]}
              onPress={() => setTimeRange(range)}
            >
              <Text
                style={[
                  styles.tabText,
                  timeRange === range && styles.tabTextActive,
                ]}
              >
                {range === 'month'
                  ? '本月'
                  : range === 'quarter'
                  ? '本季度'
                  : '本年'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* 预警提示 */}
        {getAlerts().length > 0 && (
          <View style={styles.alertsContainer}>
            {getAlerts().map((alert, index) => (
              <View
                key={`alert-${index}-${alert.type}`}
                style={[
                  styles.alertCard,
                  alert.type === 'danger' && styles.alertDanger,
                  alert.type === 'warning' && styles.alertWarning,
                  alert.type === 'info' && styles.alertInfo,
                ]}
              >
                <Icon
                  name={alert.icon}
                  size={18}
                  color={
                    alert.type === 'danger'
                      ? COLORS.danger
                      : alert.type === 'warning'
                      ? COLORS.warning
                      : COLORS.primary
                  }
                />
                <Text style={styles.alertText}>{alert.message}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 健康度评分卡片 */}
        <View style={styles.healthCard}>
          <View style={styles.healthCardHeader}>
            <Text style={styles.cardTitle}>部门健康度评分</Text>
            <TouchableOpacity
              onPress={() => setShowRuleModal(true)}
              style={styles.infoButton}
            >
              <Icon name="question-circle" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.healthCardContent}>
            {renderHealthScore()}
            <View style={styles.healthMetrics}>
              <View style={styles.healthMetricItem}>
                <Text style={styles.healthMetricLabel}>平均联系间隔</Text>
                <View style={styles.healthMetricRow}>
                  <Text style={[styles.healthMetricValue, {
                    color: (statistics.responseMetrics?.avgContactInterval || 0) <= 8 
                      ? COLORS.success 
                      : (statistics.responseMetrics?.avgContactInterval || 0) <= 11
                      ? COLORS.warning
                      : COLORS.danger
                  }]}>
                    {(statistics.responseMetrics?.avgContactInterval || 0).toFixed(1)}天
                  </Text>
                  {statistics.trends && renderTrendIndicator(statistics.trends.avgContactInterval, false, true)}
                </View>
              </View>
              <View style={styles.healthMetricItem}>
                <Text style={styles.healthMetricLabel}>有提醒人数</Text>
                <View style={styles.healthMetricRow}>
                  <Text style={[styles.healthMetricValue, { color: COLORS.primary }]}>
                    {statistics.healthScoreDetails?.totalPersonsWithReminders || 0}人
                  </Text>
                </View>
              </View>
              <View style={styles.healthMetricItem}>
                <Text style={styles.healthMetricLabel}>未处理提醒</Text>
                <View style={styles.healthMetricRow}>
                  <Text style={styles.healthMetricValue}>
                    {statistics.responseMetrics?.unhandledReminders || 0}
                  </Text>
                  {statistics.trends && renderTrendIndicator(statistics.trends.unhandledReminders, false)}
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* 统计总览 */}
        <View style={styles.monthlyStatsCard}>
          <Text style={styles.cardTitle}>
            {timeRange === 'month'
              ? '本月统计'
              : timeRange === 'quarter'
              ? '本季度统计'
              : '本年统计'}
          </Text>
          <View style={styles.monthlyStatsGrid}>
            <View style={styles.monthlyStatItem}>
              <Text
                style={[styles.monthlyStatValue, { color: COLORS.primary }]}
              >
                {statistics.activePersons}
              </Text>
              <Text style={styles.monthlyStatLabel}>在假人数</Text>
            </View>
            <View style={styles.monthlyStatItem}>
              <Text
                style={[styles.monthlyStatValue, { color: COLORS.success }]}
              >
                {statistics.totalContacts}
              </Text>
              <Text style={styles.monthlyStatLabel}>联系次数</Text>
            </View>
            <View style={styles.monthlyStatItem}>
              <Text
                style={[styles.monthlyStatValue, { color: COLORS.warning }]}
              >
                {statistics.responseMetrics?.totalReminders || 0}
              </Text>
              <Text style={styles.monthlyStatLabel}>提醒总数</Text>
            </View>
          </View>
        </View>

         {/* 响应评估卡片 */}
         <View style={styles.overviewGrid}>
           <View style={[styles.overviewCard, {flex: 1}]}>
             <View style={styles.overviewHeader}>
               <Icon name="clock-o" size={20} color={COLORS.primary} />
               <Text
                 style={[
                   styles.overviewChange,
                   {
                     color:
                       (statistics.responseMetrics?.avgContactInterval ?? 0) <= 8
                         ? COLORS.success
                         : (statistics.responseMetrics?.avgContactInterval ?? 0) <= 11
                         ? COLORS.warning
                         : COLORS.danger,
                   },
                 ]}
               >
                 {(statistics.responseMetrics?.avgContactInterval ?? 0) <= 8
                   ? '优秀'
                   : (statistics.responseMetrics?.avgContactInterval ?? 0) <= 11
                   ? '良好'
                   : '需改进'}
               </Text>
             </View>
             <View style={styles.overviewValueWithTrend}>
               <Text style={styles.overviewValue}>
                 {(statistics.responseMetrics?.avgContactInterval || 0).toFixed(1)}天
               </Text>
               {statistics.trends && renderTrendIndicator(statistics.trends.avgContactInterval, false, true)}
             </View>
             <Text style={styles.overviewLabel}>平均联系间隔</Text>
             <Text style={styles.overviewHint}>
               有活跃休假且有提醒人员的平均联系间隔
             </Text>
           </View>
        </View>

        {/* 联系频率图表 */}
        <View style={styles.card}>
          <View style={styles.chartHeader}>
            <Text style={styles.cardTitle}>联系频率趋势</Text>
            <Text style={styles.chartSummary}>
              本周总计:{' '}
              {statistics.weeklyData.reduce((sum, count) => sum + count, 0)} 次
            </Text>
          </View>
          <View style={styles.chartContainer}>{renderChart()}</View>
          <View style={styles.weekLabels}>
            {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(
              (day, index) => (
                <View key={index} style={styles.weekLabelContainer}>
                  <Text style={styles.weekLabel}>{day}</Text>
                  <Text style={styles.weekCount}>
                    {statistics.weeklyData[index]}
                  </Text>
                </View>
              ),
            )}
          </View>
        </View>

        {/* 状态分布 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>人员状态分布</Text>
          <View style={styles.distributionList}>
            <View style={styles.distributionItem}>
              <View style={styles.distributionHeader}>
                <Text style={styles.distributionLabel}>正常</Text>
                <View style={styles.distributionValueContainer}>
                  <Text style={styles.distributionCount}>
                    {statistics.statusDistribution?.normal?.count || 0}人
                  </Text>
                <Text style={styles.distributionValue}>
                    {statistics.statusDistribution?.normal?.percentage || 0}%
                </Text>
                </View>
              </View>
              <View style={styles.progressBar}>
                <LinearGradient
                  colors={COLORS.successGradient}
                  style={[
                    styles.progressFill,
                    { width: `${statistics.statusDistribution?.normal?.percentage || 0}%` },
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </View>
            </View>

            <View style={styles.distributionItem}>
              <View style={styles.distributionHeader}>
                <Text style={styles.distributionLabel}>建议联系</Text>
                <View style={styles.distributionValueContainer}>
                  <Text style={styles.distributionCount}>
                    {statistics.statusDistribution?.suggest?.count || 0}人
                  </Text>
                <Text style={styles.distributionValue}>
                    {statistics.statusDistribution?.suggest?.percentage || 0}%
                </Text>
                </View>
              </View>
              <View style={styles.progressBar}>
                <LinearGradient
                  colors={COLORS.warningGradient}
                  style={[
                    styles.progressFill,
                    { width: `${statistics.statusDistribution?.suggest?.percentage || 0}%` },
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </View>
            </View>

            <View style={styles.distributionItem}>
              <View style={styles.distributionHeader}>
                <Text style={styles.distributionLabel}>紧急</Text>
                <View style={styles.distributionValueContainer}>
                  <Text style={styles.distributionCount}>
                    {statistics.statusDistribution?.urgent?.count || 0}人
                  </Text>
                <Text style={styles.distributionValue}>
                    {statistics.statusDistribution?.urgent?.percentage || 0}%
                </Text>
                </View>
              </View>
              <View style={styles.progressBar}>
                <LinearGradient
                  colors={COLORS.dangerGradient}
                  style={[
                    styles.progressFill,
                    { width: `${statistics.statusDistribution?.urgent?.percentage || 0}%` },
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </View>
            </View>

          </View>
        </View>

        {/* 提醒处理详情 */}
        {statistics.responseMetrics && (
        <View style={[styles.card, { marginBottom: 20 }]}>
            <Text style={styles.cardTitle}>提醒处理详情</Text>
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>
                  {statistics.responseMetrics?.totalReminders || 0}
                </Text>
                <Text style={styles.metricLabel}>本月提醒总数</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={[styles.metricValue, { color: COLORS.danger }]}>
                  {statistics.responseMetrics?.unhandledReminders || 0}
                </Text>
                <Text style={styles.metricLabel}>未处理提醒</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={[styles.metricValue, { 
                  color: (statistics.responseMetrics?.avgContactInterval || 0) <= 8 
                    ? COLORS.success 
                    : (statistics.responseMetrics?.avgContactInterval || 0) <= 11
                    ? COLORS.warning
                    : COLORS.danger
                }]}>
                  {(statistics.responseMetrics?.avgContactInterval || 0).toFixed(1)}天
                </Text>
                <Text style={styles.metricLabel}>平均联系间隔</Text>
              </View>
            </View>
           </View>
        )}

        {/* 部门对比排名（管理员可见）*/}
        {statistics.departmentRanking && statistics.departmentRanking.length > 1 && (
          <View style={[styles.card, { marginBottom: 20 }]}>
            <View style={styles.rankingTitleRow}>
              <Text style={styles.cardTitle}>部门健康度排名</Text>
              <Text style={styles.rankingSubtitle}>按健康度评分排序</Text>
            </View>
            <View style={styles.departmentRankingList}>
            {statistics.departmentRanking.map((dept, index) => {
              const healthScore = dept.healthScore || 0;
              const avgContactInterval = dept.avgContactInterval || 0;
              
              // 根据健康度确定颜色
              let scoreColor = COLORS.success;
              if (healthScore < 70) {
                scoreColor = COLORS.danger;
              } else if (healthScore < 80) {
                scoreColor = COLORS.warning;
              } else if (healthScore < 90) {
                scoreColor = COLORS.primary;
              }
              
              return (
                <View key={dept.departmentId} style={styles.departmentRankItem}>
                  <View
                    style={[
                      styles.rankBadge,
                      index === 0 && styles.rankBadgeGold,
                      index === 1 && styles.rankBadgeSilver,
                      index === 2 && styles.rankBadgeBronze,
                    ]}
                  >
                    <Text style={styles.rankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.departmentRankContent}>
                    <View style={styles.departmentRankHeader}>
                      <Text style={styles.departmentName}>{dept.name}</Text>
                      <View style={styles.healthScoreBadge}>
                        <Text style={[styles.healthScoreBadgeText, { color: scoreColor }]}>
                          {healthScore}分
                        </Text>
                      </View>
                    </View>
                    <View style={styles.departmentRankStats}>
                      <View style={styles.departmentRankStat}>
                        <Text style={styles.departmentRankStatLabel}>平均间隔</Text>
                        <Text style={[
                          styles.departmentRankStatValue,
                          {
                            color: avgContactInterval <= 8 
                              ? COLORS.success 
                              : avgContactInterval <= 11
                              ? COLORS.warning
                              : COLORS.danger
                          }
                        ]}>
                          {avgContactInterval.toFixed(1)}天
                        </Text>
                      </View>
                      <View style={styles.departmentRankStat}>
                        <Text style={styles.departmentRankStatLabel}>未处理</Text>
                        <Text
                          style={[
                            styles.departmentRankStatValue,
                            { color: (dept.unhandledReminders || 0) > 0 ? COLORS.danger : COLORS.success },
                          ]}
                        >
                          {dept.unhandledReminders || 0}
                        </Text>
                      </View>
                      <View style={styles.departmentRankStat}>
                        <Text style={styles.departmentRankStatLabel}>紧急</Text>
                        <Text
                          style={[
                            styles.departmentRankStatValue,
                            { color: (dept.urgentCount || 0) > 0 ? COLORS.danger : COLORS.success },
                          ]}
                        >
                          {dept.urgentCount || 0}人
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
        )}
       </ScrollView>
       {/* 健康度规则说明Modal */}
       {renderRuleModal()}
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
    paddingBottom: 24,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: COLORS.white,
  },
  tabText: {
    fontSize: 14,
    color: COLORS.white,
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingVertical: 16,
  },
  overviewGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  overviewChange: {
    fontSize: 12,
    color: COLORS.success,
  },
  overviewValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  overviewValueWithTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overviewLabel: {
    fontSize: 12,
    color: COLORS.darkGray,
    marginTop: 4,
  },
  overviewHint: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
    fontStyle: 'italic',
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  weekLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  weekLabel: {
    fontSize: 12,
    color: COLORS.darkGray,
  },
  distributionList: {
    gap: 12,
  },
  distributionItem: {
    gap: 8,
  },
  distributionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  distributionLabel: {
    fontSize: 14,
    color: '#374151',
  },
  distributionValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distributionCount: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  distributionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  rankingList: {
    gap: 12,
  },
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rankBadge: {
    width: 24,
    height: 24,
    backgroundColor: '#D1D5DB',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankBadgeGold: {
    backgroundColor: '#FDE047',
  },
  rankBadgeSilver: {
    backgroundColor: '#E5E7EB',
  },
  rankBadgeBronze: {
    backgroundColor: '#FB923C',
  },
  rankText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  rankInfo: {
    flex: 1,
  },
  rankName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  rankDesc: {
    fontSize: 12,
    color: COLORS.darkGray,
  },
  rankPercentage: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  monthlyStatsCard: {
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
  monthlyStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  monthlyStatItem: {
    alignItems: 'center',
  },
  monthlyStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  monthlyStatLabel: {
    fontSize: 12,
    color: COLORS.darkGray,
    marginTop: 4,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartSummary: {
    fontSize: 12,
    color: COLORS.darkGray,
    fontWeight: '500',
  },
  weekLabelContainer: {
    alignItems: 'center',
    flex: 1,
  },
  weekCount: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: 'bold',
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  metricLabel: {
    fontSize: 11,
    color: COLORS.darkGray,
    marginTop: 4,
  },
  departmentSummary: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#374151',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  // 预警提示样式
  alertsContainer: {
    gap: 8,
    marginBottom: 16,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 10,
    borderLeftWidth: 4,
  },
  alertDanger: {
    backgroundColor: '#FEF2F2',
    borderLeftColor: COLORS.danger,
  },
  alertWarning: {
    backgroundColor: '#FFFBEB',
    borderLeftColor: COLORS.warning,
  },
  alertInfo: {
    backgroundColor: '#EFF6FF',
    borderLeftColor: COLORS.primary,
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  // 健康度评分样式
  healthCard: {
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
  healthCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoButton: {
    padding: 4,
  },
  healthCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  healthScoreContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthScoreTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthScoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  healthScoreLabel: {
    fontSize: 11,
    color: COLORS.darkGray,
    marginTop: 2,
  },
  healthMetrics: {
    flex: 1,
    gap: 12,
  },
  healthMetricItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  healthMetricLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  healthMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  healthMetricValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  // 趋势指示器样式
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // 部门排名样式
  departmentRankingList: {
    gap: 12,
  },
  departmentRankItem: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
  },
  departmentRankContent: {
    flex: 1,
  },
  departmentRankHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  departmentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.white,
  },
  departmentRankStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  departmentRankStat: {
    alignItems: 'center',
  },
  departmentRankStatLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },
  departmentRankStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  // Modal样式
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    paddingTop: 4,
  },
  ruleDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  ruleList: {
    gap: 8,
    marginBottom: 12,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ruleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ruleText: {
    fontSize: 13,
    color: '#374151',
  },
  ruleNote: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  // 排名标题行样式
  rankingTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rankingSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  // 健康度徽章样式
  healthScoreBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  healthScoreBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default StatisticsScreen;
