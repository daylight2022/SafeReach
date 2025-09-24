import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { COLORS } from '@/utils/constants';
import { personNoteStorage, PersonNote } from '@/utils/storage';
import { toast } from 'burnt';

interface Props {
  visible: boolean;
  personId: string;
  personName: string;
  onClose: () => void;
}

const PersonNoteModal: React.FC<Props> = ({
  visible,
  personId,
  personName,
  onClose,
}) => {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingNote, setExistingNote] = useState<PersonNote | null>(null);

  useEffect(() => {
    if (visible && personId) {
      loadExistingNote();
    }
  }, [visible, personId]);

  const loadExistingNote = () => {
    try {
      const existing = personNoteStorage.get(personId);
      setExistingNote(existing);
      setNote(existing?.note || '');
    } catch (error) {
      console.error('加载备注失败:', error);
    }
  };

  const handleSave = async () => {
    if (loading) return;

    setLoading(true);
    try {
      const success = personNoteStorage.save(personId, note.trim());

      if (success) {
        toast({
          title: note.trim() ? '备注已保存' : '备注已清空',
          preset: 'done',
          duration: 2,
        });
        onClose();
      } else {
        toast({
          title: '保存失败',
          preset: 'error',
          duration: 2,
        });
      }
    } catch (error) {
      console.error('保存备注失败:', error);
      toast({
        title: '保存失败',
        preset: 'error',
        duration: 2,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setNote('');
    toast({
      title: '备注已清空',
      preset: 'done',
      duration: 2,
    });
  };

  const handleClose = () => {
    setNote('');
    setExistingNote(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <View style={styles.modalContainer}>
            <TouchableOpacity
              activeOpacity={1}
              style={styles.modalContent}
              onPress={e => e.stopPropagation()}
            >
              {/* Drag Indicator */}
              <View style={styles.dragIndicator} />

              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <Icon name="sticky-note" size={20} color={COLORS.primary} />
                  <Text style={styles.title}>个人备注</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={handleClose}
                >
                  <Icon name="times" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Person Info */}
              <View style={styles.personInfo}>
                <Text style={styles.personName}>{personName}</Text>
                <Text style={styles.personSubtitle}>仅自己可见的提醒备注</Text>
              </View>

              {/* Note Input */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  value={note}
                  onChangeText={setNote}
                  placeholder="添加备注，如：下次联系时问一下孩子的情况..."
                  placeholderTextColor="#9CA3AF"
                  multiline={true}
                  textAlignVertical="top"
                  maxLength={500}
                  autoFocus={true}
                />
                <Text style={styles.charCount}>{note.length}/500</Text>
              </View>

              {/* Note Info */}
              {existingNote && (
                <View style={styles.noteInfo}>
                  <Text style={styles.noteInfoText}>
                    创建时间：
                    {new Date(existingNote.createdAt).toLocaleString('zh-CN')}
                  </Text>
                  {existingNote.updatedAt !== existingNote.createdAt && (
                    <Text style={styles.noteInfoText}>
                      更新时间：
                      {new Date(existingNote.updatedAt).toLocaleString('zh-CN')}
                    </Text>
                  )}
                </View>
              )}

              {/* Actions */}
              <View style={styles.actions}>
                {note.trim() && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={handleClear}
                  >
                    <Icon name="eraser" size={16} color={COLORS.danger} />
                    <Text style={styles.deleteButtonText}>清空</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.rightActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleClose}
                  >
                    <Text style={styles.cancelButtonText}>取消</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      loading && styles.saveButtonDisabled,
                    ]}
                    onPress={handleSave}
                    disabled={loading}
                  >
                    <Text style={styles.saveButtonText}>
                      {loading ? '保存中...' : '保存'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'flex-end',
    width: '100%',
  },
  modalContainer: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 70,
    maxHeight: '90%',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 8,
  },
  personInfo: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  personName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  personSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  inputContainer: {
    marginBottom: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    minHeight: 120,
    maxHeight: 200,
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 8,
  },
  noteInfo: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  noteInfoText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
  },
  deleteButtonText: {
    fontSize: 14,
    color: COLORS.danger,
    fontWeight: '500',
  },
  rightActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: '600',
  },
});

export default PersonNoteModal;
