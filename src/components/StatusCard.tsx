import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome';
import { COLORS } from '../utils/constants';
import QuickContactModal from './QuickContactModal';
import { Person } from '../types';

interface StatusCardProps {
  title: string;
  count: number;
  status: 'urgent' | 'warning' | 'normal';
  items: any[];
  onItemPress: (personId: any) => void;
  onContactComplete?: () => void;
}

const StatusCard = ({
  title,
  count,
  status,
  items,
  onItemPress,
  onContactComplete,
}: StatusCardProps) => {
  const [showContactModal, setShowContactModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  const handleContactPress = (item: any, e: any) => {
    e.stopPropagation(); // 阻止事件冒泡
    // 将 reminder 数据转换为 Person 格式
    const person: Person = {
      id: item.person?.id || '',
      name: item.person?.name || '',
      phone: item.person?.phone || '',
      emergencyContact: item.person?.emergencyContact,
      emergencyPhone: item.person?.emergencyPhone,
      departmentId: item.person?.departmentId || '',
      department: item.person?.department,
      personType: item.person?.personType || 'employee',
      annualLeaveTotal: item.person?.annualLeaveTotal || 0,
      annualLeaveUsed: item.person?.annualLeaveUsed || 0,
      annualLeaveTimes: item.person?.annualLeaveTimes || 0,
      currentLeave: item.leave,
      createdAt: item.person?.createdAt || new Date().toISOString(),
      updatedAt: item.person?.updatedAt || new Date().toISOString(),
    };
    setSelectedPerson(person);
    setShowContactModal(true);
  };

  const handleContactConfirm = () => {
    onContactComplete?.();
  };

  const getStatusColor = () => {
    switch (status) {
      case 'urgent':
        return {
          bg: '#FEF2F2',
          color: COLORS.danger,
          gradient: COLORS.dangerGradient,
        };
      case 'warning':
        return {
          bg: '#FFFBEB',
          color: COLORS.warning,
          gradient: COLORS.warningGradient,
        };
      default:
        return {
          bg: '#F0FDF4',
          color: COLORS.success,
          gradient: COLORS.successGradient,
        };
    }
  };

  const statusStyle = getStatusColor();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <View
            style={[styles.statusDot, { backgroundColor: statusStyle.color }]}
          />
          <Text style={styles.title}>{title}</Text>
        </View>
        <Text style={[styles.count, { color: statusStyle.color }]}>
          {count}人
        </Text>
      </View>

      <View style={styles.itemList}>
        {items.length > 0 ? (
          <ScrollView
            style={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            {items.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.item, { backgroundColor: statusStyle.bg }]}
                onPress={() => onItemPress(item.person?.id)}
              >
                <View style={styles.itemLeft}>
                  <LinearGradient
                    colors={statusStyle.gradient}
                    style={styles.itemIcon}
                  >
                    <Icon
                      name={status === 'urgent' ? 'exclamation' : 'clock-o'}
                      size={16}
                      color={COLORS.white}
                    />
                  </LinearGradient>
                  <View>
                    <Text style={styles.itemName}>{item.person?.name}</Text>
                    <Text style={styles.itemDesc}>
                      {status === 'urgent'
                        ? `已${item.days || 0}天未联系`
                        : item.reminder_type === 'before'
                        ? '即将休假'
                        : item.reminder_type === 'during'
                        ? '休假中'
                        : item.reminder_type === 'ending'
                        ? '即将结束休假'
                        : item.reminder_type === 'overdue'
                        ? '超期未联系'
                        : '需要联系'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[
                    styles.contactButton,
                    { backgroundColor: statusStyle.color },
                  ]}
                  onPress={(e) => handleContactPress(item, e)}
                >
                  <Text style={styles.contactButtonText}>
                    {status === 'urgent' ? '立即联系' : '联系'}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>暂无数据</Text>
          </View>
        )}
      </View>

      {/* 快捷联系弹窗 */}
      <QuickContactModal
        visible={showContactModal}
        person={selectedPerson}
        onClose={() => setShowContactModal(false)}
        onContactConfirm={handleContactConfirm}
      />
    </View>
  );
};

const styles = StyleSheet.create({
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  count: {
    fontSize: 14,
    fontWeight: '500',
  },
  itemList: {
    gap: 12,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  itemDesc: {
    fontSize: 12,
    color: COLORS.darkGray,
    marginTop: 2,
  },
  contactButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  contactButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '500',
  },
  scrollContainer: {
    maxHeight: 200,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.darkGray,
  },
});

export default StatusCard;
