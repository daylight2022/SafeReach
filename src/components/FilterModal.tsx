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

interface Props {
  visible: boolean;
  onClose: () => void;
  currentStatus: PersonStatus | 'all';
  onStatusChange: (status: PersonStatus | 'all') => void;
  currentPersonType: PersonType | 'all';
  onPersonTypeChange: (type: PersonType | 'all') => void;
  currentDepartment: string | 'all';
  onDepartmentChange: (departmentId: string | 'all') => void;
  departments: Department[];
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
  departments,
}) => {
  // 折叠状态管理
  const [expandedSections, setExpandedSections] = useState({
    department: true, // 默认展开部门
    personType: true, // 默认展开人员类型
    status: true, // 默认展开状态
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };
  const statusOptions = [
    { value: 'all', label: '全部', color: '#6B7280' },
    { value: 'urgent', label: '紧急', color: COLORS.danger },
    { value: 'suggest', label: '建议', color: COLORS.warning },
    { value: 'normal', label: '正常', color: COLORS.success },
    // { value: 'inactive', label: '在岗', color: '#6B7280' },
  ];

  const personTypeOptions = [
    { value: 'all', label: '全部类型', color: '#6B7280' },
    { value: 'employee', label: '员工', color: COLORS.primary },
    // { value: 'intern', label: '实习生', color: COLORS.warning },
    { value: 'manager', label: '小组长', color: COLORS.success },
  ];

  // 过滤掉顶级部门（level为1的部门），只显示下属单位
  const filteredDepartments = departments.filter(dept => dept.level > 1);

  const departmentOptions = [
    { value: 'all', label: '全部部门', color: '#6B7280' },
    ...filteredDepartments.map(dept => ({
      value: dept.id,
      label: dept.name,
      color: COLORS.primary,
    })),
  ];

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
              {departmentOptions.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.option,
                    currentDepartment === option.value && styles.optionActive,
                  ]}
                  onPress={() => {
                    onDepartmentChange(option.value);
                  }}
                >
                  <View
                    style={[
                      styles.optionDot,
                      { backgroundColor: option.color },
                    ]}
                  />
                  <Text
                    style={[
                      styles.optionText,
                      currentDepartment === option.value &&
                        styles.optionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </CollapsibleSection>

            {/* 人员类型筛选 - 默认展开 */}
            <CollapsibleSection title="人员类型" sectionKey="personType">
              {personTypeOptions.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.option,
                    currentPersonType === option.value && styles.optionActive,
                  ]}
                  onPress={() => {
                    onPersonTypeChange(option.value as PersonType | 'all');
                  }}
                >
                  <View
                    style={[
                      styles.optionDot,
                      { backgroundColor: option.color },
                    ]}
                  />
                  <Text
                    style={[
                      styles.optionText,
                      currentPersonType === option.value &&
                        styles.optionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </CollapsibleSection>

            {/* 状态筛选 - 默认折叠 */}
            <CollapsibleSection title="状态筛选" sectionKey="status">
              {statusOptions.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.option,
                    currentStatus === option.value && styles.optionActive,
                  ]}
                  onPress={() => {
                    onStatusChange(option.value as PersonStatus | 'all');
                  }}
                >
                  <View
                    style={[
                      styles.optionDot,
                      { backgroundColor: option.color },
                    ]}
                  />
                  <Text
                    style={[
                      styles.optionText,
                      currentStatus === option.value && styles.optionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </CollapsibleSection>
          </ScrollView>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => {
                onStatusChange('all');
                onPersonTypeChange('all');
                onDepartmentChange('all');
              }}
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    gap: 12,
  },
  optionActive: {
    backgroundColor: '#EEF2FF',
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
