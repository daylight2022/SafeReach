import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import LinearGradient from 'react-native-linear-gradient';
import { NavigationProp, RouteProp } from '@react-navigation/native';
import {
  personService,
  leaveService,
  departmentService,
} from '@/services/apiServices';
import { COLORS } from '@/utils/constants';
import { Person, Department } from '@/types';
import {
  showOperationSuccessToast,
  showOperationErrorToast,
  showWarningToast,
  showSuccessToast,
} from '@/utils/errorHandler';
import DateTimePicker from 'react-native-ui-datepicker';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import SmartTextParser from '@/components/SmartTextParser';
import { ParsedLeaveInfo } from '@/utils/textParser';

// Departments are now loaded from API

// 人员类型选项 (removed intern as requested)
const PERSON_TYPES = [
  { value: 'employee', label: '员工' },
  { value: 'manager', label: '小组长' },
];

interface Props {
  navigation: NavigationProp<any>;
  route: RouteProp<any, any>;
}

const AddPersonScreen: React.FC<Props> = ({ navigation, route }) => {
  const editPerson = route.params?.person as Person | undefined;
  const isEdit = !!editPerson;

  // 设置dayjs中文本地化
  dayjs.locale('zh-cn');

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    emergencyContact: '',
    emergencyPhone: '',
    departmentId: '',
    departmentName: '', // For display purposes
    personType: 'employee' as 'employee' | 'manager', // Remove intern option
    annualLeaveTotal: '30',
    annualLeaveUsed: '0',
    annualLeaveTimes: '0',
  });

  const [departments, setDepartments] = useState<Department[]>([]);

  const [leaveData, setLeaveData] = useState({
    leaveType: 'vacation' as
      | 'vacation'
      | 'business'
      | 'study'
      | 'hospitalization',
    location: '',
    startDate: new Date(),
    endDate: new Date(),
  });

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showPersonTypeModal, setShowPersonTypeModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSmartParser, setShowSmartParser] = useState(false);

  useEffect(() => {
    loadDepartments();

    if (editPerson) {
      setFormData({
        name: editPerson.name,
        phone: editPerson.phone || '',
        emergencyContact: editPerson.emergencyContact || '',
        emergencyPhone: editPerson.emergencyPhone || '',
        departmentId: editPerson.departmentId || '',
        departmentName: '', // Will be set after departments load
        personType:
          (editPerson.personType === 'intern'
            ? 'employee'
            : editPerson.personType) || 'employee',
        annualLeaveTotal: editPerson.annualLeaveTotal.toString(),
        annualLeaveUsed: editPerson.annualLeaveUsed.toString(),
        annualLeaveTimes: editPerson.annualLeaveTimes.toString(),
      });
    }
  }, [editPerson]);

  const loadDepartments = async () => {
    try {
      const result = await departmentService.getDepartments();

      if (result.success && result.data) {
        // 后端返回的是分页格式，数据直接在data字段中
        const departmentList: Department[] = Array.isArray(result.data)
          ? result.data
          : [];

        // 过滤掉顶级部门（level = 1），只显示下属层级部门
        // 因为添加的在外人员只会是下属层级部门
        const filteredDepartments = departmentList.filter(
          dept => dept.level > 1,
        );

        console.log(
          '🏢 加载部门列表成功，共',
          departmentList.length,
          '个部门，过滤后',
          filteredDepartments.length,
          '个',
        );
        setDepartments(filteredDepartments);

        // If editing and departmentId exists, find and set department name
        // 注意：这里使用原始列表查找，因为编辑时可能需要显示顶级部门的名称
        if (editPerson?.departmentId && departmentList.length > 0) {
          const dept = departmentList.find(
            (d: Department) => d.id === editPerson.departmentId,
          );
          if (dept) {
            setFormData(prev => ({ ...prev, departmentName: dept.name }));
          }
        }
      } else {
        console.error('🏢 部门API返回失败:', result.message);
      }
    } catch (error) {
      console.error('🏢 加载部门列表失败:', error);
    }
  };

  const calculateDays = () => {
    const days =
      dayjs(leaveData.endDate).diff(dayjs(leaveData.startDate), 'days') + 1;
    return days > 0 ? days : 0;
  };

  const calculateRemainingLeave = () => {
    const total = parseInt(formData.annualLeaveTotal) || 0;
    const used = parseInt(formData.annualLeaveUsed) || 0;
    return total - used;
  };

  const handleSmartParsed = (parsed: ParsedLeaveInfo) => {
    // 填充人员基本信息
    if (parsed.name) {
      setFormData(prev => ({ ...prev, name: parsed.name! }));
    }
    if (parsed.phone) {
      setFormData(prev => ({ ...prev, phone: parsed.phone! }));
    }
    if (parsed.emergencyContact) {
      setFormData(prev => ({
        ...prev,
        emergencyContact: parsed.emergencyContact!,
      }));
    }
    if (parsed.emergencyPhone) {
      setFormData(prev => ({
        ...prev,
        emergencyPhone: parsed.emergencyPhone!,
      }));
    }

    // 填充在外信息
    if (parsed.location) {
      setLeaveData(prev => ({ ...prev, location: parsed.location! }));
    }
    if (parsed.startDate) {
      setLeaveData(prev => ({
        ...prev,
        startDate: new Date(parsed.startDate!),
      }));
    }
    if (parsed.endDate) {
      setLeaveData(prev => ({ ...prev, endDate: new Date(parsed.endDate!) }));
    }

    // 如果有备注信息，设置到notes中
    if (parsed.notes) {
      setNotes(parsed.notes);
    }

    showSuccessToast(
      '智能解析完成',
      '已自动填充相关字段，请检查并补充完整信息',
    );
  };

  const validateForm = () => {
    if (!formData.name) {
      showWarningToast('请输入姓名', '姓名是必填字段');
      return false;
    }
    if (!formData.phone) {
      showWarningToast('请输入电话', '联系电话是必填字段');
      return false;
    }
    if (!formData.departmentId) {
      showWarningToast('请选择部门', '请为人员分配所属部门');
      return false;
    }
    if (!formData.personType) {
      showWarningToast('请选择人员类型', '请指定人员的职位类型');
      return false;
    }
    // 非编辑模式下，必须填写在外信息
    if (!isEdit && !leaveData.location) {
      showWarningToast('请填写在外地点', '新增人员需要填写在外信息');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      if (isEdit) {
        // 更新人员信息
        const result = await personService.updatePerson(editPerson.id, {
          name: formData.name,
          phone: formData.phone,
          emergencyContact: formData.emergencyContact,
          emergencyPhone: formData.emergencyPhone,
          departmentId: formData.departmentId,
          personType: formData.personType,
          annualLeaveTotal: parseInt(formData.annualLeaveTotal),
          annualLeaveUsed: parseInt(formData.annualLeaveUsed),
          annualLeaveTimes: parseInt(formData.annualLeaveTimes),
        });

        if (!result.success) {
          console.error('更新人员信息失败:', result.message);
          throw new Error(`更新失败: ${result.message}`);
        }

        showOperationSuccessToast('update', formData.name);
      } else {
        // 创建新人员
        const result = await personService.createPerson({
          name: formData.name,
          phone: formData.phone,
          emergencyContact: formData.emergencyContact,
          emergencyPhone: formData.emergencyPhone,
          departmentId: formData.departmentId,
          personType: formData.personType,
          annualLeaveTotal: parseInt(formData.annualLeaveTotal),
          annualLeaveUsed: parseInt(formData.annualLeaveUsed),
          annualLeaveTimes: parseInt(formData.annualLeaveTimes),
        });
        if (!result.success) {
          console.error('创建人员失败:', result.message);
          throw new Error(`创建失败: ${result.message}`);
        }

        const personData = result.data;
        let leaveCreationFailed = false;

        // 如果填写了在外信息，创建在外记录
        if (leaveData.location && personData) {
          const leaveResult = await leaveService.createLeave({
            personId: personData.id,
            leaveType: leaveData.leaveType,
            location: leaveData.location,
            startDate: dayjs(leaveData.startDate).format('YYYY-MM-DD'),
            endDate: dayjs(leaveData.endDate).format('YYYY-MM-DD'),
            days: calculateDays(),
            status: 'active',
          });

          if (!leaveResult.success) {
            console.error('创建在外记录失败:', leaveResult.message);
            leaveCreationFailed = true;
            // 在外记录创建失败不影响人员创建，只是警告
            showWarningToast(
              '人员创建成功，但在外记录创建失败',
              '请手动添加在外信息',
            );
          }
        }

        // 只有在没有在外记录创建失败的情况下才显示完全成功的提示
        if (!leaveCreationFailed) {
          showOperationSuccessToast('create', formData.name);
        }
      }

      navigation.goBack();
    } catch (error) {
      console.error('保存错误:', error);
      showOperationErrorToast(
        isEdit ? 'update' : 'create',
        error,
        formData.name,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={20} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.title}>{isEdit ? '编辑人员' : '添加人员'}</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          <Text
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          >
            保存
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* 基本信息 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>基本信息</Text>
            {!isEdit && (
              <TouchableOpacity
                style={styles.smartParseButton}
                onPress={() => setShowSmartParser(true)}
              >
                <Icon name="magic" size={14} color={COLORS.primary} />
                <Text style={styles.smartParseButtonText}>智能解析</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>姓名</Text>
            <TextInput
              placeholder="请输入姓名"
              value={formData.name}
              onChangeText={(text: string) =>
                setFormData({ ...formData, name: text })
              }
              style={styles.input}
              placeholderTextColor="#9CA3AF"
              underlineColorAndroid="transparent"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>部门</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowDepartmentModal(true)}
            >
              <Text
                style={[
                  styles.inputText,
                  !formData.departmentName && styles.placeholderText,
                ]}
              >
                {formData.departmentName || '请选择部门'}
              </Text>
              <Icon name="chevron-down" size={14} color={COLORS.darkGray} />
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>人员类型</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowPersonTypeModal(true)}
            >
              <Text
                style={[
                  styles.inputText,
                  !formData.personType && styles.placeholderText,
                ]}
              >
                {PERSON_TYPES.find(type => type.value === formData.personType)
                  ?.label || '请选择人员类型'}
              </Text>
              <Icon name="chevron-down" size={14} color={COLORS.darkGray} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 在外信息 */}
        {!isEdit && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>在外信息</Text>
            <View style={styles.formGroup}>
              <Text style={styles.label}>在外类型</Text>
              <View style={styles.typeSelector}>
                {(
                  ['vacation', 'business', 'study', 'hospitalization'] as const
                ).map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeOption,
                      leaveData.leaveType === type && styles.typeOptionActive,
                    ]}
                    onPress={() =>
                      setLeaveData({ ...leaveData, leaveType: type })
                    }
                  >
                    <Text
                      style={[
                        styles.typeText,
                        leaveData.leaveType === type && styles.typeTextActive,
                      ]}
                    >
                      {type === 'vacation'
                        ? '休假'
                        : type === 'business'
                        ? '出差'
                        : type === 'study'
                        ? '学习'
                        : '住院'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>在外地点</Text>
              <TextInput
                placeholder="详细到市/区"
                value={leaveData.location}
                onChangeText={(text: string) =>
                  setLeaveData({ ...leaveData, location: text })
                }
                style={styles.input}
                placeholderTextColor="#9CA3AF"
                underlineColorAndroid="transparent"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>开始日期</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Text style={styles.dateText}>
                  {dayjs(leaveData.startDate).format('YYYY-MM-DD')}
                </Text>
                <Icon name="calendar" size={16} color={COLORS.darkGray} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>结束日期</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Text style={styles.dateText}>
                  {dayjs(leaveData.endDate).format('YYYY-MM-DD')}
                </Text>
                <Icon name="calendar" size={16} color={COLORS.darkGray} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>本次天数</Text>
              <View style={[styles.input, styles.disabledInput]}>
                <Text style={styles.disabledText}>{calculateDays()}天</Text>
              </View>
            </View>
          </View>
        )}

        {/* 联系方式 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>联系方式</Text>
          <View style={styles.formGroup}>
            <Text style={styles.label}>本人电话</Text>
            <TextInput
              placeholder="请输入手机号"
              keyboardType="phone-pad"
              value={formData.phone}
              onChangeText={(text: string) =>
                setFormData({ ...formData, phone: text })
              }
              style={styles.input}
              placeholderTextColor="#9CA3AF"
              underlineColorAndroid="transparent"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>第三方联系人</Text>
            <TextInput
              placeholder="请输入姓名"
              value={formData.emergencyContact}
              onChangeText={(text: string) =>
                setFormData({ ...formData, emergencyContact: text })
              }
              style={styles.input}
              placeholderTextColor="#9CA3AF"
              underlineColorAndroid="transparent"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>第三方联系电话</Text>
            <TextInput
              placeholder="请输入手机号"
              keyboardType="phone-pad"
              value={formData.emergencyPhone}
              onChangeText={(text: string) =>
                setFormData({ ...formData, emergencyPhone: text })
              }
              style={styles.input}
              placeholderTextColor="#9CA3AF"
              underlineColorAndroid="transparent"
            />
          </View>
        </View>

        {/* 假期信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>假期信息</Text>
          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>本年拥有</Text>
              <TextInput
                placeholder="天数"
                keyboardType="number-pad"
                value={formData.annualLeaveTotal}
                onChangeText={(text: string) =>
                  setFormData({ ...formData, annualLeaveTotal: text })
                }
                style={styles.input}
                placeholderTextColor="#9CA3AF"
                underlineColorAndroid="transparent"
              />
            </View>

            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>已休假期</Text>
              <TextInput
                placeholder="天数"
                keyboardType="number-pad"
                value={formData.annualLeaveUsed}
                onChangeText={(text: string) =>
                  setFormData({ ...formData, annualLeaveUsed: text })
                }
                style={styles.input}
                placeholderTextColor="#9CA3AF"
                underlineColorAndroid="transparent"
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>已休次数</Text>
              <TextInput
                placeholder="次数"
                keyboardType="number-pad"
                value={formData.annualLeaveTimes}
                onChangeText={(text: string) =>
                  setFormData({ ...formData, annualLeaveTimes: text })
                }
                style={styles.input}
                placeholderTextColor="#9CA3AF"
                underlineColorAndroid="transparent"
              />
            </View>

            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>剩余假期</Text>
              <View style={[styles.input, styles.disabledInput]}>
                <Text style={styles.disabledText}>
                  {calculateRemainingLeave()}天
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 备注 */}
        <View style={[styles.section, { marginBottom: 100 }]}>
          <Text style={styles.label}>备注信息</Text>
          <TextInput
            placeholder="请输入备注..."
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
            style={[styles.input, styles.textArea]}
            placeholderTextColor="#9CA3AF"
            underlineColorAndroid="transparent"
          />
        </View>
      </ScrollView>

      {/* Date Pickers */}
      {showStartDatePicker && (
        <View style={styles.datePickerModal}>
          <View style={styles.datePickerContainer}>
            <Text style={styles.datePickerTitle}>选择开始日期</Text>
            <DateTimePicker
              mode="single"
              date={dayjs(leaveData.startDate)}
              onChange={params => {
                // 确保使用本地时间，避免时区问题
                const selectedDate = dayjs(params.date).startOf('day').toDate();
                setLeaveData({
                  ...leaveData,
                  startDate: selectedDate,
                });
                setShowStartDatePicker(false);
              }}
            />
            <TouchableOpacity
              style={styles.datePickerCancel}
              onPress={() => setShowStartDatePicker(false)}
            >
              <Text style={styles.datePickerCancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showEndDatePicker && (
        <View style={styles.datePickerModal}>
          <View style={styles.datePickerContainer}>
            <Text style={styles.datePickerTitle}>选择结束日期</Text>
            <DateTimePicker
              mode="single"
              date={dayjs(leaveData.endDate)}
              onChange={params => {
                const selectedDate = dayjs(params.date).startOf('day');
                // 确保结束日期不早于开始日期
                if (
                  selectedDate.isBefore(
                    dayjs(leaveData.startDate).startOf('day'),
                  )
                ) {
                  return;
                }
                setLeaveData({
                  ...leaveData,
                  endDate: selectedDate.toDate(),
                });
                setShowEndDatePicker(false);
              }}
            />
            <TouchableOpacity
              style={styles.datePickerCancel}
              onPress={() => setShowEndDatePicker(false)}
            >
              <Text style={styles.datePickerCancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bottom Actions */}
      {/* <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelButtonText}>取消</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.submitButtonContainer}
          onPress={handleSave}
          disabled={saving}
        >
          <LinearGradient
            colors={COLORS.primaryGradient}
            style={[styles.submitButton, saving && styles.submitButtonDisabled]}
          >
            <Text style={styles.submitButtonText}>保存</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View> */}

      {/* 部门选择模态框 */}
      <Modal
        visible={showDepartmentModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDepartmentModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDepartmentModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>选择部门</Text>
            {departments.map(dept => (
              <TouchableOpacity
                key={dept.id}
                style={[
                  styles.modalOption,
                  formData.departmentId === dept.id &&
                    styles.modalOptionSelected,
                ]}
                onPress={() => {
                  setFormData({
                    ...formData,
                    departmentId: dept.id,
                    departmentName: dept.name,
                  });
                  setShowDepartmentModal(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    formData.departmentId === dept.id &&
                      styles.modalOptionTextSelected,
                  ]}
                >
                  {dept.name}
                </Text>
                {formData.departmentId === dept.id && (
                  <Icon name="check" size={16} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 人员类型选择模态框 */}
      <Modal
        visible={showPersonTypeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPersonTypeModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPersonTypeModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>选择人员类型</Text>
            {PERSON_TYPES.map(type => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.modalOption,
                  formData.personType === type.value &&
                    styles.modalOptionSelected,
                ]}
                onPress={() => {
                  setFormData({
                    ...formData,
                    personType: type.value as 'employee' | 'manager',
                  });
                  setShowPersonTypeModal(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    formData.personType === type.value &&
                      styles.modalOptionTextSelected,
                  ]}
                >
                  {type.label}
                </Text>
                {formData.personType === type.value && (
                  <Icon name="check" size={16} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 智能文本解析模态框 */}
      <Modal
        visible={showSmartParser}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSmartParser(false)}
      >
        <SmartTextParser
          onParsed={handleSmartParsed}
          onClose={() => setShowSmartParser(false)}
        />
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  saveButton: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '500',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  scrollContent: {
    paddingBottom: 100, // 为底部按钮留出空间
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  smartParseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.white,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  smartParseButtonText: {
    fontSize: 12,
    color: COLORS.primary,
    marginLeft: 4,
    fontWeight: '500',
  },
  formGroup: {
    marginBottom: 12,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },

  label: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 14,
    color: '#111827',
    paddingVertical: 0,
    textAlignVertical: 'center',
    paddingTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputText: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
  },
  placeholderText: {
    color: '#9CA3AF',
  },
  disabledInput: {
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
  },
  disabledText: {
    color: '#111827',
    fontSize: 14,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOption: {
    width: '48%',
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  typeOptionActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  typeText: {
    fontSize: 14,
    color: '#374151',
  },
  typeTextActive: {
    color: COLORS.white,
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateText: {
    fontSize: 14,
    color: '#111827',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  submitButtonContainer: {
    flex: 1,
  },
  submitButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  datePickerModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    margin: 20,
    maxHeight: '80%',
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  datePickerCancel: {
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
  },
  datePickerCancelText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    margin: 20,
    maxHeight: '80%',
    minWidth: 280,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  modalOptionSelected: {
    backgroundColor: '#F3F4F6',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#374151',
  },
  modalOptionTextSelected: {
    color: COLORS.primary,
    fontWeight: '500',
  },
});

export default AddPersonScreen;
