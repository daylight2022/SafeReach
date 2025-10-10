import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { COLORS } from '../utils/constants';
import { Person, PersonStatus } from '../types';
import { personNoteStorage } from '../utils/storage';
import PersonNoteModal from './PersonNoteModal';
import QuickContactModal from './QuickContactModal';
import dayjs from 'dayjs';

interface Props {
  person: Person;
  onPress: () => void;
  onContact: () => void;
}

const PersonCard: React.FC<Props> = ({ person, onPress, onContact }) => {
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  // Maximum length for location text
  const MAX_LOCATION_LENGTH = 10;

  const truncateLocation = (location: string) => {
    if (location.length <= MAX_LOCATION_LENGTH) {
      return location;
    }
    return location.substring(0, MAX_LOCATION_LENGTH) + '...';
  };

  const getStatusStyle = (status: PersonStatus) => {
    switch (status) {
      case 'urgent':
        return {
          borderColor: COLORS.danger,
          badgeColor: '#FEF2F2',
          badgeText: COLORS.danger,
          buttonColor: COLORS.danger,
          statusText: '紧急',
        };
      case 'suggest':
        return {
          borderColor: COLORS.warning,
          badgeColor: '#FFFBEB',
          badgeText: COLORS.warning,
          buttonColor: COLORS.warning,
          statusText: '建议',
        };
      case 'normal':
        return {
          borderColor: COLORS.success,
          badgeColor: '#F0FDF4',
          badgeText: COLORS.success,
          buttonColor: COLORS.success,
          statusText: '正常',
        };
      default:
        return {
          borderColor: '#D1D5DB',
          badgeColor: '#F3F4F6',
          badgeText: '#6B7280',
          buttonColor: '#6B7280',
          statusText: '在岗',
        };
    }
  };

  const status = person.status || 'inactive';
  const style = getStatusStyle(status);
  const currentLeave = person.currentLeave;
  const lastContact = person.lastContact;

  const getDaysSinceContact = () => {
    if (!lastContact) return null;
    // 使用 startOf('day') 按日历日期计算，而不是绝对24小时
    return dayjs().startOf('day').diff(dayjs(lastContact.contactDate).startOf('day'), 'days');
  };

  const getHumanizedContactTime = () => {
    const days = getDaysSinceContact();
    if (days === null) return '未联系';

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

  const getRemainingDays = () => {
    if (!currentLeave) return null;
    // 计算剩余天数：包含今天在内，所以需要 +1
    // 例如：今天10号，到假11号，diff=1天，但实际剩余2天（10、11）
    const diffDays = dayjs(currentLeave.endDate).diff(dayjs().startOf('day'), 'days');
    return diffDays + 1;
  };

  const hasNote = personNoteStorage.hasNote(person.id);

  const handleInfoPress = () => {
    setShowNoteModal(true);
  };

  const handleContactPress = (e: any) => {
    e.stopPropagation(); // 阻止事件冒泡
    setShowContactModal(true);
  };

  const handleContactConfirm = () => {
    // 调用原来的联系回调
    onContact();
  };

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: style.borderColor }]}
      onPress={onPress}
    >
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={[styles.avatar, { backgroundColor: style.badgeColor }]}>
            <Text style={[styles.avatarText, { color: style.badgeText }]}>
              {person.name[0]}
            </Text>
          </View>
          <View>
            <Text style={styles.name}>{person.name}</Text>
            <Text style={styles.subtitle}>
              {person.department?.name ||
                person.departmentInfo?.name ||
                '未设置部门'}
              {' · '}
              {currentLeave
                ? `${
                    currentLeave.leaveType === 'vacation'
                      ? '休假中'
                      : currentLeave.leaveType === 'business'
                      ? '出差中'
                      : currentLeave.leaveType === 'study'
                      ? '学习中'
                      : currentLeave.leaveType === 'hospitalization'
                      ? '住院中'
                      : '陪护中'
                  } · ${truncateLocation(currentLeave.location || '')}`
                : '未在假'}
            </Text>
          </View>
        </View>
        <View style={[styles.badge, { backgroundColor: style.badgeColor }]}>
          <Text style={[styles.badgeText, { color: style.badgeText }]}>
            {style.statusText}
          </Text>
        </View>
      </View>

      <View style={styles.info}>
        <Text style={styles.infoText}>
          最后联系：{getHumanizedContactTime()}
        </Text>
        <Text style={styles.infoText}>
          剩余假期：
          {getRemainingDays() !== null ? `${getRemainingDays()}天` : '-'}
        </Text>
      </View>

      <View style={styles.actions}>
        {status !== 'inactive' ? (
          <>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: style.buttonColor },
              ]}
              onPress={handleContactPress}
            >
              <Text style={styles.primaryButtonText}>
                {status === 'urgent'
                  ? '立即联系'
                  : status === 'normal'
                  ? '已联系'
                  : '联系'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.infoButton, hasNote && styles.infoButtonWithNote]}
              onPress={handleInfoPress}
            >
              <Icon
                name={hasNote ? 'sticky-note' : 'info-circle'}
                size={20}
                color={hasNote ? COLORS.primary : '#6B7280'}
              />
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={[styles.primaryButton, styles.viewButton]}>
            <Text style={styles.viewButtonText}>查看详情</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 个人备注模态框 */}
      <PersonNoteModal
        visible={showNoteModal}
        personId={person.id}
        personName={person.name}
        onClose={() => setShowNoteModal(false)}
      />

      {/* 快捷联系模态框 */}
      <QuickContactModal
        visible={showContactModal}
        person={person}
        onClose={() => setShowContactModal(false)}
        onContactConfirm={handleContactConfirm}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
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
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.darkGray,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  info: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.darkGray,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '500',
  },
  viewButton: {
    backgroundColor: '#F3F4F6',
  },
  viewButtonText: {
    color: COLORS.darkGray,
    fontSize: 14,
    fontWeight: '500',
  },
  infoButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    justifyContent: 'center',
  },
  infoButtonWithNote: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
});

export default PersonCard;
