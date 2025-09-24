import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { COLORS } from '@/utils/constants';
import { Person } from '@/types';
import { openWeChat } from '@/utils/wechat';

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
  if (!person) return null;

  const handleCall = (phone: string) => {
    if (!phone) {
      Alert.alert('提示', '该联系人未填写电话号码');
      return;
    }
    Linking.openURL(`tel:${phone}`);
    onContactConfirm?.();
    onClose();
  };

  const handleWechat = async () => {
    await openWeChat();
    onContactConfirm?.();
    onClose();
  };

  const handleSMS = (phone: string) => {
    if (!phone) {
      Alert.alert('提示', '该联系人未填写电话号码');
      return;
    }
    Linking.openURL(`sms:${phone}`);
    onContactConfirm?.();
    onClose();
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
});

export default QuickContactModal;
