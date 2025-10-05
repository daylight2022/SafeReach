import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { COLORS } from '../utils/constants';
import { PersonStatus, Department } from '../types';

type PersonType = 'employee' | 'intern' | 'manager';
type LeaveType = 'vacation' | 'business' | 'study' | 'hospitalization' | 'care';

interface Props {
  visible: boolean;
  onClose: () => void;
  currentStatus: PersonStatus[];
  onStatusChange: (status: PersonStatus[]) => void;
  currentPersonType: PersonType[];
  onPersonTypeChange: (type: PersonType[]) => void;
  currentDepartment: string[];
  onDepartmentChange: (departmentIds: string[]) => void;
  currentLeaveType: LeaveType[];
  onLeaveTypeChange: (types: LeaveType[]) => void;
  departments: Department[];
  onReset: () => void;
}

const FilterModal: React.FC<Props> = ({
  visible,
  onClose,
  currentStatus,
  onStatusChange,
  currentPersonType,
  onPersonTypeChange,
  currentDepartment,
  onDepartmentChange,
  currentLeaveType,
  onLeaveTypeChange,
  departments,
  onReset,
}) => {
  // 折叠状态管理 - 默认只展开部门筛选
  const [expandedSections, setExpandedSections] = useState({
    department: true, // 默认展开部门
    leaveType: false, // 默认折叠在外类别
    personType: false, // 默认折叠人员类型
    status: false, // 默认折叠状态
  });

  // 切换选择项
  const toggleSelection = <T,>(
    currentSelection: T[],
    value: T,
    onChange: (selection: T[]) => void,
  ) => {
    if (currentSelection.includes(value)) {
      // 取消选择
      onChange(currentSelection.filter(item => item !== value));
    } else {
      // 添加选择
      onChange([...currentSelection, value]);
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };
  const statusOptions = [
    { value: 'urgent', label: '紧急', color: COLORS.danger },
    { value: 'suggest', label: '建议', color: COLORS.warning },
    { value: 'normal', label: '正常', color: COLORS.success },
  ] as const;

  const personTypeOptions = [
    { value: 'employee', label: '员工', color: COLORS.primary },
    { value: 'manager', label: '小组长', color: COLORS.success },
  ] as const;

  const leaveTypeOptions = [
    { value: 'vacation', label: '休假', color: '#10B981' },
    { value: 'business', label: '出差', color: '#3B82F6' },
    { value: 'study', label: '学习', color: '#8B5CF6' },
    { value: 'hospitalization', label: '住院', color: '#EF4444' },
    { value: 'care', label: '陪护', color: '#F59E0B' },
  ] as const;

  // 过滤掉顶级部门（level为1的部门），只显示下属单位
  const filteredDepartments = departments.filter(dept => dept.level > 1);

  const departmentOptions = filteredDepartments.map(dept => ({
    value: dept.id,
    label: dept.name,
    color: COLORS.primary,
  }));

  // 调试日志（可选）
  // console.log('🏢 FilterModal departments:', departments.length, departments);
  // console.log('🏢 FilterModal filtered departments:', filteredDepartments.length, filteredDepartments);

  // 可折叠分组组件
  const CollapsibleSection = ({
    title,
    sectionKey,
    children,
  }: {
    title: string;
    sectionKey: keyof typeof expandedSections;
    children: React.ReactNode;
  }) => {
    const isExpanded = expandedSections[sectionKey];

    return (
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => toggleSection(sectionKey)}
        >
          <Text style={styles.sectionTitle}>{title}</Text>
          <Icon
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color="#6B7280"
          />
        </TouchableOpacity>
        {isExpanded && <View style={styles.options}>{children}</View>}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>筛选条件</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>关闭</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 部门筛选 - 放在最上面，默认展开 */}
            <CollapsibleSection title="部门筛选" sectionKey="department">
              {departmentOptions.map(option => {
                const isSelected = currentDepartment.includes(option.value);
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.option,
                      isSelected && styles.optionActive,
                    ]}
                    onPress={() => {
                      toggleSelection(currentDepartment, option.value, onDepartmentChange);
                    }}
                  >
                    <View style={styles.optionLeft}>
                      <View
                        style={[
                          styles.optionDot,
                          { backgroundColor: option.color },
                        ]}
                      />
                      <Text
                        style={[
                          styles.optionText,
                          isSelected && styles.optionTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </View>
                    {isSelected && (
                      <Icon name="check" size={16} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </CollapsibleSection>

            {/* 在外类别筛选 - 默认折叠 */}
            <CollapsibleSection title="在外类别" sectionKey="leaveType">
              {leaveTypeOptions.map(option => {
                const isSelected = currentLeaveType.includes(option.value as LeaveType);
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.option,
                      isSelected && styles.optionActive,
                    ]}
                    onPress={() => {
                      toggleSelection(currentLeaveType, option.value as LeaveType, onLeaveTypeChange);
                    }}
                  >
                    <View style={styles.optionLeft}>
                      <View
                        style={[
                          styles.optionDot,
                          { backgroundColor: option.color },
                        ]}
                      />
                      <Text
                        style={[
                          styles.optionText,
                          isSelected && styles.optionTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </View>
                    {isSelected && (
                      <Icon name="check" size={16} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </CollapsibleSection>

            {/* 人员类型筛选 - 默认折叠 */}
            <CollapsibleSection title="人员类型" sectionKey="personType">
              {personTypeOptions.map(option => {
                const isSelected = currentPersonType.includes(option.value as PersonType);
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.option,
                      isSelected && styles.optionActive,
                    ]}
                    onPress={() => {
                      toggleSelection(currentPersonType, option.value as PersonType, onPersonTypeChange);
                    }}
                  >
                    <View style={styles.optionLeft}>
                      <View
                        style={[
                          styles.optionDot,
                          { backgroundColor: option.color },
                        ]}
                      />
                      <Text
                        style={[
                          styles.optionText,
                          isSelected && styles.optionTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </View>
                    {isSelected && (
                      <Icon name="check" size={16} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </CollapsibleSection>

            {/* 状态筛选 - 默认折叠 */}
            <CollapsibleSection title="状态筛选" sectionKey="status">
              {statusOptions.map(option => {
                const isSelected = currentStatus.includes(option.value as PersonStatus);
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.option,
                      isSelected && styles.optionActive,
                    ]}
                    onPress={() => {
                      toggleSelection(currentStatus, option.value as PersonStatus, onStatusChange);
                    }}
                  >
                    <View style={styles.optionLeft}>
                      <View
                        style={[
                          styles.optionDot,
                          { backgroundColor: option.color },
                        ]}
                      />
                      <Text
                        style={[
                          styles.optionText,
                          isSelected && styles.optionTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </View>
                    {isSelected && (
                      <Icon name="check" size={16} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </CollapsibleSection>
          </ScrollView>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={onReset}
            >
              <Text style={styles.resetButtonText}>重置</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={onClose}>
              <Text style={styles.confirmButtonText}>确定</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  content: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingBottom: 32,
    maxHeight: '80%', // 限制最大高度，确保有滚动空间
  },
  scrollContent: {
    maxHeight: 400, // 设置滚动区域的最大高度
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    fontSize: 16,
    color: COLORS.primary,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  options: {
    gap: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  optionActive: {
    backgroundColor: '#EEF2FF',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  optionText: {
    fontSize: 16,
    color: '#374151',
  },
  optionTextActive: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 8,
  },
  resetButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: '500',
  },
});

export default FilterModal;
