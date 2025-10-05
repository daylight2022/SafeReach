import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import LinearGradient from 'react-native-linear-gradient';
import { COLORS } from '@/utils/constants';
import { Person } from '@/types';
import { openWeChat } from '@/utils/wechat';
import { contactService, reminderService } from '@/services/apiServices';
import { userStorage } from '@/utils/storage';
import {
  showOperationSuccessToast,
  showOperationErrorToast,
} from '@/utils/errorHandler';

interface Props {
  visible: boolean;
  person: Person | null;
  onClose: () => void;
  onContactConfirm?: () => void;
}

const QuickContactModal: React.FC<Props> = ({
  visible,
  person,
  onClose,
  onContactConfirm,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!person) return null;

  const handleCall = (phone: string) => {
    if (!phone) {
      Alert.alert('提示', '该联系人未填写电话号码');
      return;
    }
    Linking.openURL(`tel:${phone}`);
    // 不立即关闭，让用户可以点击"完成联系"按钮
  };

  const handleWechat = async () => {
    await openWeChat();
    // 不立即关闭，让用户可以点击"完成联系"按钮
  };

  const handleSMS = (phone: string) => {
    if (!phone) {
      Alert.alert('提示', '该联系人未填写电话号码');
      return;
    }
    Linking.openURL(`sms:${phone}`);
    // 不立即关闭，让用户可以点击"完成联系"按钮
  };

  const handleCompleteContact = async () => {
    Alert.alert('确认联系', '确认已完成联系？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确认',
        onPress: async () => {
          setIsSubmitting(true);
          try {
            const contactDate = new Date().toISOString();

            // 获取当前用户信息
            const currentUser = await userStorage.getCurrentUser();
            if (!currentUser) {
              throw new Error('无法获取当前用户信息，请重新登录');
            }

            // 使用后端API创建联系记录
            const contactResult = await contactService.createContact({
              personId: person.id,
              leaveId: person.currentLeave?.id || undefined,
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
                await reminderService.handlePersonReminders(person.id);
              if (reminderResult.success) {
                const handledCount = reminderResult.data?.handledCount || 0;
                console.log(`✅ 已标记 ${handledCount} 条提醒记录为已处理`);
              } else {
                console.warn('标记提醒记录失败:', reminderResult.message);
              }
            } catch (reminderError) {
              console.warn('标记提醒记录时出错:', reminderError);
            }

            showOperationSuccessToast('contact');
            onContactConfirm?.();
            onClose();
          } catch (error) {
            console.error('联系确认失败:', error);
            showOperationErrorToast('contact', error);
          } finally {
            setIsSubmitting(false);
          }
        },
      },
    ]);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} onPress={onClose}>
        <View style={styles.modalContainer}>
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.personInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{person.name[0]}</Text>
                </View>
                <View>
                  <Text style={styles.personName}>{person.name}</Text>
                  <Text style={styles.personDept}>
                    {person.department?.name || '未填写部门'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Icon name="times" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Contact Options */}
            <View style={styles.contactOptions}>
              {/* 本人电话 */}
              <TouchableOpacity
                style={styles.contactItem}
                onPress={() => handleCall(person.phone || '')}
              >
                <View style={styles.contactLeft}>
                  <View
                    style={[styles.contactIcon, { backgroundColor: '#10B981' }]}
                  >
                    <Icon name="phone" size={20} color={COLORS.white} />
                  </View>
                  <View>
                    <Text style={styles.contactTitle}>本人电话</Text>
                    <Text style={styles.contactValue}>
                      {person.phone || '未填写'}
                    </Text>
                  </View>
                </View>
                <Icon name="chevron-right" size={16} color="#9CA3AF" />
              </TouchableOpacity>


              {/* 短信联系 */}
              <TouchableOpacity
                style={styles.contactItem}
                onPress={() => handleSMS(person.phone || '')}
              >
                <View style={styles.contactLeft}>
                  <View
                    style={[styles.contactIcon, { backgroundColor: '#3B82F6' }]}
                  >
                    <Icon name="comment" size={20} color={COLORS.white} />
                  </View>
                  <View>
                    <Text style={styles.contactTitle}>短信联系</Text>
                    <Text style={styles.contactValue}>
                      {person.phone || '未填写'}
                    </Text>
                  </View>
                </View>
                <Icon name="chevron-right" size={16} color="#9CA3AF" />
              </TouchableOpacity>

              {/* 第三方联系人 */}
              {person.emergencyContact && (
                <TouchableOpacity
                  style={styles.contactItem}
                  onPress={() => handleCall(person.emergencyPhone || '')}
                >
                  <View style={styles.contactLeft}>
                    <View
                      style={[
                        styles.contactIcon,
                        { backgroundColor: '#F59E0B' },
                      ]}
                    >
                      <Icon name="user-o" size={20} color={COLORS.white} />
                    </View>
                    <View>
                      <Text style={styles.contactTitle}>第三方联系人</Text>
                      <Text style={styles.contactValue}>
                        {person.emergencyContact} ·{' '}
                        {person.emergencyPhone || '未填写'}
                      </Text>
                    </View>
                  </View>
                  <Icon name="chevron-right" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            {/* 完成联系按钮 */}
            <TouchableOpacity
              style={styles.completeButton}
              onPress={handleCompleteContact}
              disabled={isSubmitting}
            >
              <LinearGradient
                colors={COLORS.successGradient}
                style={styles.completeButtonGradient}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Icon
                      name="check-circle"
                      size={18}
                      color={COLORS.white}
                      style={styles.completeButtonIcon}
                    />
                    <Text style={styles.completeButtonText}>完成联系</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
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
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  personInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  personName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  personDept: {
    fontSize: 12,
    color: COLORS.darkGray,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  contactOptions: {
    gap: 12,
  },
  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.gray,
    borderRadius: 12,
  },
  contactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  contactValue: {
    fontSize: 12,
    color: COLORS.darkGray,
    marginTop: 2,
  },
  completeButton: {
    marginTop: 16,
  },
  completeButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  completeButtonIcon: {
    marginRight: 8,
  },
  completeButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default QuickContactModal;
