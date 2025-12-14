import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../utils/constants';

type LeaveType = 'vacation' | 'business' | 'study' | 'hospitalization' | 'care';

type LeaveTypeCounts = Record<LeaveType, number>;

interface Props {
  total: number;
  leaveTypeCounts: LeaveTypeCounts;
}

const leaveTypeMeta: Array<{
  type: LeaveType;
  label: string;
  color: string;
}> = [
  { type: 'vacation', label: '休假', color: '#10B981' },
  { type: 'business', label: '出差', color: '#3B82F6' },
  { type: 'study', label: '学习', color: '#8B5CF6' },
  { type: 'hospitalization', label: '住院', color: '#EF4444' },
  { type: 'care', label: '陪护', color: '#F59E0B' },
];

const PersonStatsBar: React.FC<Props> = ({ total, leaveTypeCounts }) => {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>当前列表</Text>
        <Text style={styles.totalText}>
          共<Text style={styles.totalNumber}>{total}</Text>人
        </Text>
      </View>

      <View style={styles.grid}>
        {leaveTypeMeta.map(item => {
          const count = leaveTypeCounts[item.type] || 0;
          return (
            <View key={item.type} style={styles.pill}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <Text style={styles.pillText}>
                {item.label} {count}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  totalText: {
    fontSize: 12,
    color: '#111827',
  },
  totalNumber: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  pillText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
});

export default PersonStatsBar;
