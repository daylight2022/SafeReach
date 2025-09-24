import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome';
import Svg, { Rect } from 'react-native-svg';
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

interface Statistics {
  totalContacts: number;
  totalPersons: number;
  avgFrequency: string;
  avgResponseDays: number;
  weeklyData: number[];
  statusDistribution: {
    normal: number;
    suggest: number;
    urgent: number;
  };
  departmentRanking: Array<{
    name: string;
    avgResponse: number;
    percentage: number;
  }>;
  responseMetrics?: {
    totalScore: number;
    unhandledReminders: number;
    handledOnTime: number;
    handledLate: number;
    proactiveContacts: number;
    responseGrade: string;
  };
}

const StatisticsScreen: React.FC<Props> = ({ navigation }) => {
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year'>(
    'month',
  );
  const [statistics, setStatistics] = useState<Statistics>({
    totalContacts: 0,
    totalPersons: 0,
    avgFrequency: '0',
    avgResponseDays: 0,
    weeklyData: [0, 0, 0, 0, 0, 0, 0],
    statusDistribution: {
      normal: 0,
      suggest: 0,
      urgent: 0,
    },
    departmentRanking: [],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStatistics();
  }, [timeRange]);

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

        setStatistics({
          totalContacts: data.totalContacts || 0,
          totalPersons: data.totalPersons || 0,
          avgFrequency: data.avgFrequency || '0',
          avgResponseDays: data.avgResponseDays || 0,
          weeklyData: data.weeklyData || [60, 75, 85, 90, 100, 80, 70],
          statusDistribution: data.statusDistribution || {
            normal: 65,
            suggest: 25,
            urgent: 10,
          },
          departmentRanking: data.departmentRanking || [
            { name: '技术部', avgResponse: 1.2, percentage: 98 },
            { name: '市场部', avgResponse: 2.1, percentage: 92 },
            { name: '行政部', avgResponse: 3.5, percentage: 85 },
          ],
          responseMetrics: data.responseMetrics,
        });
      } else {
        console.error('获取统计数据失败:', statsResult.message);
        // 设置默认数据
        setStatistics({
          totalContacts: 0,
          totalPersons: 0,
          avgFrequency: '0',
          avgResponseDays: 0,
          weeklyData: [60, 75, 85, 90, 100, 80, 70],
          statusDistribution: {
            normal: 65,
            suggest: 25,
            urgent: 10,
          },
          departmentRanking: [
            { name: '技术部', avgResponse: 1.2, percentage: 98 },
            { name: '市场部', avgResponse: 2.1, percentage: 92 },
            { name: '行政部', avgResponse: 3.5, percentage: 85 },
          ],
        });
      }
    } catch (error) {
      console.error('Load statistics error:', error);
      // 设置默认数据
      setStatistics({
        totalContacts: 0,
        totalPersons: 0,
        avgFrequency: '0',
        avgResponseDays: 0,
        weeklyData: [60, 75, 85, 90, 100, 80, 70],
        statusDistribution: {
          normal: 65,
          suggest: 25,
          urgent: 10,
        },
        departmentRanking: [
          { name: '技术部', avgResponse: 1.2, percentage: 98 },
          { name: '市场部', avgResponse: 2.1, percentage: 92 },
          { name: '行政部', avgResponse: 3.5, percentage: 85 },
        ],
      });
    } finally {
      setLoading(false);
    }
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
      >
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
                {statistics.totalPersons}
              </Text>
              <Text style={styles.monthlyStatLabel}>总人数</Text>
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
                {statistics.avgFrequency}
              </Text>
              <Text style={styles.monthlyStatLabel}>平均频率</Text>
            </View>
          </View>
        </View>

        {/* 响应评估卡片 */}
        <View style={styles.overviewGrid}>
          <View style={styles.overviewCard}>
            <View style={styles.overviewHeader}>
              <Icon name="star" size={20} color={COLORS.primary} />
              <Text
                style={[
                  styles.overviewChange,
                  {
                    color:
                      (statistics.responseMetrics?.totalScore ?? 0) >= 80
                        ? COLORS.success
                        : (statistics.responseMetrics?.totalScore ?? 0) >= 60
                        ? COLORS.warning
                        : COLORS.danger,
                  },
                ]}
              >
                {statistics.responseMetrics?.responseGrade || 'N/A'}
              </Text>
            </View>
            <Text style={styles.overviewValue}>
              {statistics.responseMetrics?.totalScore?.toFixed(1) || '0'}
            </Text>
            <Text style={styles.overviewLabel}>响应评分</Text>
          </View>

          <View style={styles.overviewCard}>
            <View style={styles.overviewHeader}>
              <Icon name="clock-o" size={20} color={COLORS.warning} />
              <Text
                style={[
                  styles.overviewChange,
                  {
                    color:
                      statistics.avgResponseDays <= 1
                        ? COLORS.success
                        : COLORS.danger,
                  },
                ]}
              >
                {statistics.avgResponseDays <= 1 ? '优秀' : '需改进'}
              </Text>
            </View>
            <Text style={styles.overviewValue}>
              {statistics.avgResponseDays}
            </Text>
            <Text style={styles.overviewLabel}>平均响应天数</Text>
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
                <Text style={styles.distributionValue}>
                  {statistics.statusDistribution.normal}%
                </Text>
              </View>
              <View style={styles.progressBar}>
                <LinearGradient
                  colors={COLORS.successGradient}
                  style={[
                    styles.progressFill,
                    { width: `${statistics.statusDistribution.normal}%` },
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </View>
            </View>

            <View style={styles.distributionItem}>
              <View style={styles.distributionHeader}>
                <Text style={styles.distributionLabel}>建议联系</Text>
                <Text style={styles.distributionValue}>
                  {statistics.statusDistribution.suggest}%
                </Text>
              </View>
              <View style={styles.progressBar}>
                <LinearGradient
                  colors={COLORS.warningGradient}
                  style={[
                    styles.progressFill,
                    { width: `${statistics.statusDistribution.suggest}%` },
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </View>
            </View>

            <View style={styles.distributionItem}>
              <View style={styles.distributionHeader}>
                <Text style={styles.distributionLabel}>紧急</Text>
                <Text style={styles.distributionValue}>
                  {statistics.statusDistribution.urgent}%
                </Text>
              </View>
              <View style={styles.progressBar}>
                <LinearGradient
                  colors={COLORS.dangerGradient}
                  style={[
                    styles.progressFill,
                    { width: `${statistics.statusDistribution.urgent}%` },
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </View>
            </View>
          </View>
        </View>

        {/* 单位排名 */}
        <View style={[styles.card, { marginBottom: 20 }]}>
          <Text style={styles.cardTitle}>单位联系排名</Text>
          <View style={styles.rankingList}>
            {statistics.departmentRanking.map((dept, index) => (
              <View key={index} style={styles.rankingItem}>
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
                <View style={styles.rankInfo}>
                  <Text style={styles.rankName}>{dept.name}</Text>
                  <Text style={styles.rankDesc}>
                    平均响应 {dept.avgResponse}天
                  </Text>
                </View>
                <Text
                  style={[
                    styles.rankPercentage,
                    {
                      color:
                        dept.percentage >= 90 ? COLORS.success : COLORS.warning,
                    },
                  ]}
                >
                  {dept.percentage}%
                </Text>
              </View>
            ))}
          </View>
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
  overviewLabel: {
    fontSize: 12,
    color: COLORS.darkGray,
    marginTop: 4,
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
  },
  distributionLabel: {
    fontSize: 14,
    color: '#374151',
  },
  distributionValue: {
    fontSize: 14,
    fontWeight: '500',
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
});

export default StatisticsScreen;
